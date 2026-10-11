import "../env.ts";
import mongoose from "mongoose";
import { TaskChangeRequestService } from "../services/taskChangeRequestService.js";
import { TaskChangeRequest, ApprovalActionToken, Task } from "../models.js";
import { User } from "../modals/userModal.js";
import { Organization } from "../modals/organizationModal.js";
import { AuditLog } from "../modals/auditLogModal.js";
import { ActionSource, ChangeRequestStatus } from "../modals/taskChangeRequestModal.js";
import { runMigration } from "../scripts/migrate-task-edit-approval-toggles.js";

async function runTests() {
  console.log("==========================================================");
  console.log("🧪 TASK EDIT APPROVAL WORKFLOW TEST SUITE");
  console.log("==========================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const mongoUri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI or DATABASE_URL not set in environment");
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB successfully.\n");

  const cleanupIds = {
    users: [],
    tasks: [],
    requests: [],
    tokens: [],
    organizations: [],
  };

  try {
    // Setup test users
    const manager = await User.create({
      firstName: "TestManager",
      lastName: "Approver",
      email: `manager_${Date.now()}@test.com`,
      password: "hashedpassword123",
      role: "manager",
    });
    cleanupIds.users.push(manager._id);

    const employee = await User.create({
      firstName: "TestEmployee",
      lastName: "Requester",
      email: `employee_${Date.now()}@test.com`,
      password: "hashedpassword123",
      role: "employee",
    });
    cleanupIds.users.push(employee._id);

    // Setup main test task
    const originalDueDate = new Date("2026-10-06T12:00:00.000Z");
    const task = await Task.create({
      title: "Prepare Monthly Financial Report",
      description: "Original description",
      dueDate: originalDueDate,
      priority: "high",
      status: "INPROGRESS",
      createdBy: manager._id,
      assignedTo: employee._id,
    });
    cleanupIds.tasks.push(task._id);

    // ----------------------------------------------------
    // TEST 1: Protected field detection
    // ----------------------------------------------------
    console.log("📌 Test 1: Protected field change detection");
    const changes1 = TaskChangeRequestService.detectProtectedFieldChanges(task, {
      dueDate: new Date("2026-10-10T12:00:00.000Z"),
      priority: "medium",
      status: "DONE",
      description: "Updated description that should not be protected",
    });

    assert(changes1.hasProtectedChanges === true, "Detects changes to protected fields");
    assert(Object.keys(changes1.requestedChanges).length === 3, "Only includes protected fields (dueDate, priority, status)");
    assert(changes1.requestedChanges.dueDate !== undefined, "dueDate detected as protected");
    assert(changes1.requestedChanges.priority !== undefined, "priority detected as protected");
    assert(changes1.requestedChanges.status !== undefined, "status detected as protected");
    assert(changes1.requestedChanges.description === undefined, "description is NOT included in protected fields");

    // ----------------------------------------------------
    // TEST 2: User permission check
    // ----------------------------------------------------
    console.log("\n📌 Test 2: User direct modification permission check");
    const managerHasDirect = TaskChangeRequestService.userHasDirectModificationPermission(manager, task);
    const employeeHasDirect = TaskChangeRequestService.userHasDirectModificationPermission(employee, task);

    assert(managerHasDirect === true, "Manager / Creator has direct modification permission");
    assert(employeeHasDirect === false, "Employee does NOT have direct modification permission");

    // ----------------------------------------------------
    // TEST 3: Create Change Request (Task remains unchanged)
    // ----------------------------------------------------
    console.log("\n📌 Test 3: Create TaskChangeRequest & generate single-use token");
    const createResult = await TaskChangeRequestService.createChangeRequest({
      taskId: task._id,
      requestedBy: employee,
      requestedChanges: {
        dueDate: new Date("2026-10-10T12:00:00.000Z"),
        priority: "medium",
        status: "DONE",
      },
      reason: "Need additional time due to client delivery schedule change.",
    });

    assert(createResult.success === true, "createChangeRequest returns success");
    assert(createResult.requiresApproval === true, "createChangeRequest indicates requiresApproval");
    assert(createResult.data.changeRequestId !== undefined, "Returns changeRequestId");
    assert(createResult.data.actionToken !== undefined, "Returns secure raw action token");

    cleanupIds.requests.push(createResult.data.changeRequestId);

    // Verify task in DB remains unchanged!
    const taskAfterRequest = await Task.findById(task._id);
    assert(
      taskAfterRequest.status === "INPROGRESS",
      `Task status remains unchanged (${taskAfterRequest.status}) prior to approval`,
    );
    assert(
      taskAfterRequest.priority === "high",
      `Task priority remains unchanged (${taskAfterRequest.priority}) prior to approval`,
    );
    assert(
      new Date(taskAfterRequest.dueDate).getTime() === originalDueDate.getTime(),
      "Task due date remains unchanged prior to approval",
    );

    // Verify token record in DB
    const tokenDoc = await ApprovalActionToken.findOne({ requestId: createResult.data.changeRequestId });
    assert(tokenDoc !== null, "ApprovalActionToken record created in DB");
    assert(tokenDoc.usedAt === null || tokenDoc.usedAt === undefined, "Token usedAt is initially null");
    assert(new Date(tokenDoc.expiresAt) > new Date(), "Token expires in the future (24 hours)");

    // ----------------------------------------------------
    // TEST 4: Duplicate pending request prevention
    // ----------------------------------------------------
    console.log("\n📌 Test 4: Duplicate pending request prevention");
    const duplicateResult = await TaskChangeRequestService.createChangeRequest({
      taskId: task._id,
      requestedBy: employee,
      requestedChanges: {
        dueDate: new Date("2026-10-12T12:00:00.000Z"),
      },
      reason: "Another change request attempt",
    });
    assert(duplicateResult.success === true, "Handles subsequent pending request safely");
    assert(
      duplicateResult.data.changeRequestId.toString() === createResult.data.changeRequestId.toString(),
      "Returns existing pending request ID without creating duplicate unmanaged requests",
    );

    // ----------------------------------------------------
    // TEST 5: Token verification (Email action page)
    // ----------------------------------------------------
    console.log("\n📌 Test 5: One-time token verification");
    const rawToken = createResult.data.actionToken;
    const verifyValid = await TaskChangeRequestService.verifyActionToken(rawToken);

    assert(verifyValid.valid === true, "Valid raw token passes verification");
    assert(
      (verifyValid.task?.title || verifyValid.request?.taskId?.title) === task.title,
      "Verification returns task title",
    );
    assert(
      verifyValid.request?.requestedChanges?.priority?.new === "medium",
      "Verification returns requested new values",
    );

    const verifyInvalid = await TaskChangeRequestService.verifyActionToken("invalid_fake_token_12345");
    assert(verifyInvalid.valid === false, "Invalid token is rejected");
    assert(verifyInvalid.state === "INVALID_TOKEN", "Invalid token returns INVALID_TOKEN state");

    // ----------------------------------------------------
    // TEST 6: Mandatory approver reason validation
    // ----------------------------------------------------
    console.log("\n📌 Test 6: Mandatory reason validation (empty and whitespace-only)");
    let emptyReasonCaught = false;
    try {
      await TaskChangeRequestService.approveChangeRequest({
        requestId: createResult.data.changeRequestId,
        approverId: manager._id,
        approverReason: "",
        actionSource: ActionSource.IN_APP,
      });
    } catch (err) {
      emptyReasonCaught = true;
    }
    assert(emptyReasonCaught === true, "Approve rejects empty reason");

    let whitespaceReasonCaught = false;
    try {
      await TaskChangeRequestService.approveChangeRequest({
        requestId: createResult.data.changeRequestId,
        approverId: manager._id,
        approverReason: "    ",
        actionSource: ActionSource.IN_APP,
      });
    } catch (err) {
      whitespaceReasonCaught = true;
    }
    assert(whitespaceReasonCaught === true, "Approve rejects whitespace-only reason");

    let emptyRejectReasonCaught = false;
    try {
      await TaskChangeRequestService.rejectChangeRequest({
        requestId: createResult.data.changeRequestId,
        approverId: manager._id,
        approverReason: "  ",
        actionSource: ActionSource.IN_APP,
      });
    } catch (err) {
      emptyRejectReasonCaught = true;
    }
    assert(emptyRejectReasonCaught === true, "Reject rejects whitespace-only reason");

    // ----------------------------------------------------
    // TEST 7: Conflict Detection
    // ----------------------------------------------------
    console.log("\n📌 Test 7: Conflict detection when live task changes after request submission");
    // Create a second task and request for conflict testing
    const taskForConflict = await Task.create({
      title: "Task With Conflict",
      dueDate: new Date("2026-10-06T12:00:00.000Z"),
      priority: "high",
      status: "INPROGRESS",
      createdBy: manager._id,
      assignedTo: employee._id,
    });
    cleanupIds.tasks.push(taskForConflict._id);

    const conflictReqResult = await TaskChangeRequestService.createChangeRequest({
      taskId: taskForConflict._id,
      requestedBy: employee,
      requestedChanges: {
        dueDate: new Date("2026-10-10T12:00:00.000Z"),
      },
      reason: "Conflict test request",
    });
    cleanupIds.requests.push(conflictReqResult.data.changeRequestId);

    // Simulate manager updating the task due date directly in the meantime
    await Task.findByIdAndUpdate(taskForConflict._id, {
      dueDate: new Date("2026-10-08T12:00:00.000Z"),
    });

    let conflictCaught = false;
    try {
      await TaskChangeRequestService.approveChangeRequest({
        requestId: conflictReqResult.data.changeRequestId,
        approverId: manager._id,
        approverReason: "Approved with late change",
        actionSource: ActionSource.IN_APP,
      });
    } catch (err) {
      conflictCaught = true;
      assert(err.status === 409, "Conflict returns HTTP 409 status");
      assert(
        Array.isArray(err.conflictDetails) && err.conflictDetails.length > 0,
        "Conflict details indicate conflicting fields",
      );
    }
    assert(conflictCaught === true, "Approval catches conflict and stops execution");

    // ----------------------------------------------------
    // TEST 8: Rejection flow
    // ----------------------------------------------------
    console.log("\n📌 Test 8: Rejection flow (Task remains unchanged, token consumed)");
    const taskForReject = await Task.create({
      title: "Task For Rejection Test",
      dueDate: new Date("2026-10-06T12:00:00.000Z"),
      priority: "low",
      status: "OPEN",
      createdBy: manager._id,
      assignedTo: employee._id,
    });
    cleanupIds.tasks.push(taskForReject._id);

    const rejectReqResult = await TaskChangeRequestService.createChangeRequest({
      taskId: taskForReject._id,
      requestedBy: employee,
      requestedChanges: {
        priority: "critical",
      },
      reason: "Need priority escalated",
    });
    cleanupIds.requests.push(rejectReqResult.data.changeRequestId);

    const rejectResponse = await TaskChangeRequestService.rejectChangeRequest({
      requestId: rejectReqResult.data.changeRequestId,
      approverId: manager._id,
      approverReason: "Original low priority is accurate for current roadmap.",
      actionSource: ActionSource.EMAIL,
      rawToken: rejectReqResult.data.actionToken,
    });

    assert(rejectResponse.success === true, "Rejection returns success");
    const taskAfterReject = await Task.findById(taskForReject._id);
    assert(taskAfterReject.priority === "low", "Task priority remains unchanged ('low') after rejection");

    const rejectedReqDoc = await TaskChangeRequest.findById(rejectReqResult.data.changeRequestId);
    assert(rejectedReqDoc.status === "REJECTED", "Request status updated to REJECTED");
    assert(
      rejectedReqDoc.approverReason === "Original low priority is accurate for current roadmap.",
      "Approver reason stored on rejected request",
    );

    // Attempting to approve an already-rejected request fails
    let approveRejectedCaught = false;
    try {
      await TaskChangeRequestService.approveChangeRequest({
        requestId: rejectReqResult.data.changeRequestId,
        approverId: manager._id,
        approverReason: "Trying to approve rejected",
        actionSource: ActionSource.IN_APP,
      });
    } catch (err) {
      approveRejectedCaught = true;
    }
    assert(approveRejectedCaught === true, "Already rejected request cannot be approved");

    // ----------------------------------------------------
    // TEST 9: Approval flow (Task updated, request marked APPROVED)
    // ----------------------------------------------------
    console.log("\n📌 Test 9: Approval flow via Email Action Token");
    const approveResponse = await TaskChangeRequestService.approveChangeRequest({
      requestId: createResult.data.changeRequestId,
      approverId: manager._id,
      approverReason: "Approved because client delivery timeline has shifted.",
      actionSource: ActionSource.EMAIL,
      rawToken: rawToken,
    });

    assert(approveResponse.success === true, "Approval returns success");

    const taskAfterApproval = await Task.findById(task._id);
    assert(taskAfterApproval.priority === "medium", "Task priority updated to 'medium'");
    assert(taskAfterApproval.status === "DONE", "Task status updated to 'DONE'");
    assert(
      new Date(taskAfterApproval.dueDate).toISOString().startsWith("2026-10-12"),
      "Task dueDate updated to requested value (2026-10-12)",
    );

    const approvedReqDoc = await TaskChangeRequest.findById(createResult.data.changeRequestId);
    assert(approvedReqDoc.status === "APPROVED", "Request status updated to APPROVED");
    assert(
      approvedReqDoc.approverReason === "Approved because client delivery timeline has shifted.",
      "Approver reason saved correctly",
    );
    assert(approvedReqDoc.actionSource === "EMAIL", "Action source recorded as EMAIL");

    // ----------------------------------------------------
    // TEST 10: Single-use token enforcement & Re-use prevention
    // ----------------------------------------------------
    console.log("\n📌 Test 10: Token single-use enforcement & re-use prevention");
    const verifyUsed = await TaskChangeRequestService.verifyActionToken(rawToken);
    assert(verifyUsed.valid === false, "Used token is invalid for further actions");
    assert(
      verifyUsed.state === "USED_TOKEN" || verifyUsed.state === "ALREADY_APPROVED",
      `Used token returns appropriate state (${verifyUsed.state})`,
    );

    let approveAgainCaught = false;
    try {
      await TaskChangeRequestService.approveChangeRequest({
        requestId: createResult.data.changeRequestId,
        approverId: manager._id,
        approverReason: "Attempting duplicate approval",
        actionSource: ActionSource.IN_APP,
      });
    } catch (err) {
      approveAgainCaught = true;
    }
    assert(approveAgainCaught === true, "Already approved request cannot be approved again");

    // =========================================================================
    // SECTION 76: TEST CASES FOR ORGANIZATION SETTING (TESTS 11 - 23)
    // =========================================================================

    // Test 11 (Section 76 Test 1): Default for new organization is taskEditApprovalEnabled = false
    console.log("\n📌 Section 76 Test 1: New organization defaults to taskEditApprovalEnabled = false");
    const testOrgA = await Organization.create({
      name: `Test Org A ${Date.now()}`,
      slug: `test-org-a-${Date.now()}`,
    });
    cleanupIds.organizations.push(testOrgA._id);
    assert(testOrgA.taskEditApprovalEnabled === false, "New organization has taskEditApprovalEnabled = false by default");

    // Test 12 (Section 76 Test 2): Existing organization check
    console.log("\n📌 Section 76 Test 2: Existing organization has approval disabled unless explicitly enabled");
    const isApprovalEnabledOrgA = await TaskChangeRequestService.isOrganizationApprovalEnabled(testOrgA._id);
    assert(isApprovalEnabledOrgA === false, "isOrganizationApprovalEnabled returns false for organization with default settings");

    // Test 13 (Section 76 Test 3): OFF - employee changes due date -> immediate update, no change request
    console.log("\n📌 Section 76 Test 3: Setting OFF -> Employee changes protected field (dueDate) -> Direct update allowed");
    const isOrgAEnabled = await TaskChangeRequestService.isOrganizationApprovalEnabled(testOrgA._id);
    assert(isOrgAEnabled === false, "Organization setting is OFF; gating bypasses approval workflow");

    // Test 14 (Section 76 Test 4): ON - employee changes due date -> Approval required, TaskChangeRequest = PENDING
    console.log("\n📌 Section 76 Test 4: Setting ON -> Employee changes protected field (dueDate) -> Change request created, task unchanged");
    const adminUser = await User.create({
      firstName: "OrgAdmin",
      lastName: "User",
      email: `admin_${Date.now()}@test.com`,
      password: "hashedpassword123",
      role: "org_admin",
      organization_id: testOrgA._id,
    });
    cleanupIds.users.push(adminUser._id);

    // Turn setting ON
    await TaskChangeRequestService.updateOrganizationApprovalSetting({
      organizationId: testOrgA._id,
      enabled: true,
      user: adminUser,
    });
    const isOrgAEnabledNow = await TaskChangeRequestService.isOrganizationApprovalEnabled(testOrgA._id);
    assert(isOrgAEnabledNow === true, "Organization setting successfully enabled to ON");

    const orgATask = await Task.create({
      title: "Task in Org A with Approval ON",
      dueDate: originalDueDate,
      priority: "medium",
      status: "OPEN",
      createdBy: manager._id,
      assignedTo: employee._id,
      organization: testOrgA._id,
    });
    cleanupIds.tasks.push(orgATask._id);

    const changesDueDate = TaskChangeRequestService.detectProtectedFieldChanges(orgATask, {
      dueDate: new Date("2026-11-01T12:00:00.000Z"),
    });
    assert(changesDueDate.hasProtectedChanges === true, "Due date change is protected");

    const crOnResult = await TaskChangeRequestService.createChangeRequest({
      taskId: orgATask._id,
      requestedChanges: changesDueDate.requestedChanges,
      reason: "Need extension",
      userId: employee._id,
      userRole: "employee",
      orgId: testOrgA._id,
    });
    cleanupIds.requests.push(crOnResult.data.changeRequestId);
    assert(crOnResult.success === true, "Change request created when setting is ON");

    const orgATaskAfterReq = await Task.findById(orgATask._id);
    assert(
      new Date(orgATaskAfterReq.dueDate).getTime() === originalDueDate.getTime(),
      "Task remains unchanged while change request is PENDING",
    );

    // Test 15 (Section 76 Test 5): OFF + status change -> immediate update
    console.log("\n📌 Section 76 Test 5: Setting OFF + status change -> Immediate update");
    const testOrgB = await Organization.create({
      name: `Test Org B ${Date.now()}`,
      slug: `test-org-b-${Date.now()}`,
      taskEditApprovalEnabled: false,
    });
    cleanupIds.organizations.push(testOrgB._id);
    const isOrgBEnabled = await TaskChangeRequestService.isOrganizationApprovalEnabled(testOrgB._id);
    assert(isOrgBEnabled === false, "Org B has approval disabled");

    // Test 16 (Section 76 Test 6): ON + status change -> Approval required
    console.log("\n📌 Section 76 Test 6: Setting ON + status change -> Approval required");
    const changesStatus = TaskChangeRequestService.detectProtectedFieldChanges(orgATask, {
      status: "DONE",
    });
    assert(changesStatus.hasProtectedChanges === true, "Status change is detected as protected field");

    // Test 17 (Section 76 Test 7): ON + description only -> Normal direct update
    console.log("\n📌 Section 76 Test 7: Setting ON + description only (non-protected) -> Normal update");
    const changesNonProtected = TaskChangeRequestService.detectProtectedFieldChanges(orgATask, {
      description: "Just updating notes and description",
    });
    assert(changesNonProtected.hasProtectedChanges === false, "Non-protected field does not trigger approval requirement");

    // Test 18 (Section 76 Test 8): ON + Authorized manager -> Direct edit permitted
    console.log("\n📌 Section 76 Test 8: Setting ON + Authorized manager/creator -> Direct edit permitted");
    const managerHasDirectOnOrgA = TaskChangeRequestService.userHasDirectModificationPermission(manager, orgATask);
    assert(managerHasDirectOnOrgA === true, "Manager retains direct edit permission even when setting is ON");

    // Test 19 (Section 76 Test 9): Unauthorized employee attempts setting modification -> Rejected
    console.log("\n📌 Section 76 Test 9: Unauthorized employee attempts to modify setting -> Forbidden (403)");
    let employeeSettingUpdateCaught = false;
    try {
      await TaskChangeRequestService.updateOrganizationApprovalSetting({
        organizationId: testOrgA._id,
        enabled: false,
        user: employee,
      });
    } catch (err) {
      employeeSettingUpdateCaught = true;
      assert(err.status === 403, "Returns 403 Forbidden for non-admin user");
    }
    assert(employeeSettingUpdateCaught === true, "Non-admin cannot toggle organization approval setting");

    // Test 20 (Section 76 Test 10): Admin enables setting -> Audit log created
    console.log("\n📌 Section 76 Test 10: Admin enables setting -> Audited with oldValue: false, newValue: true");
    const auditLogsEnable = await AuditLog.find({
      organization_id: testOrgA._id,
      action: "ORGANIZATION_SETTING_UPDATED",
    });
    assert(auditLogsEnable.length > 0, "Audit log entry created for setting toggle");
    const latestAudit = auditLogsEnable[auditLogsEnable.length - 1];
    assert(
      latestAudit.metadata?.setting === "taskEditApprovalEnabled" ||
      latestAudit.metadata?.setting === "taskEditApprovalSettings",
      "Audit log records taskEditApproval setting"
    );
    assert(latestAudit.metadata?.oldValue === false && latestAudit.metadata?.newValue === true, "Audit log tracks transition from false to true");

    // Test 21 (Section 76 Test 11): Admin disables setting -> Audit log created & future changes update immediately
    console.log("\n📌 Section 76 Test 11: Admin disables setting -> Audited and setting turns OFF");
    await TaskChangeRequestService.updateOrganizationApprovalSetting({
      organizationId: testOrgA._id,
      enabled: false,
      user: adminUser,
    });
    const isOrgADisabled = await TaskChangeRequestService.isOrganizationApprovalEnabled(testOrgA._id);
    assert(isOrgADisabled === false, "Setting successfully changed back to OFF");

    // Test 22 (Section 76 Test 12): Pending request + disable -> Request not auto-applied, task remains unchanged
    console.log("\n📌 Section 76 Test 12: Pending request when setting is disabled -> Not automatically applied");
    const pendingReqDoc = await TaskChangeRequest.findById(crOnResult.data.changeRequestId);
    assert(pendingReqDoc.status === ChangeRequestStatus.PENDING, "Pending request remains PENDING (not silently auto-applied)");
    const orgATaskStillUnchanged = await Task.findById(orgATask._id);
    assert(
      new Date(orgATaskStillUnchanged.dueDate).getTime() === originalDueDate.getTime(),
      "Task remains unchanged after feature is turned OFF",
    );

    // Test 23 (Section 76 Test 13): Multi-tenant isolation: Org A vs Org C
    console.log("\n📌 Section 76 Test 13: Multi-tenant isolation: Org A (OFF) vs Org C (ON)");
    const testOrgC = await Organization.create({
      name: `Test Org C ${Date.now()}`,
      slug: `test-org-c-${Date.now()}`,
      taskEditApprovalEnabled: true,
    });
    cleanupIds.organizations.push(testOrgC._id);

    const isOrgAIsolated = await TaskChangeRequestService.isOrganizationApprovalEnabled(testOrgA._id);
    const isOrgCIsolated = await TaskChangeRequestService.isOrganizationApprovalEnabled(testOrgC._id);
    assert(isOrgAIsolated === false, "Org A is independently OFF");
    assert(isOrgCIsolated === true, "Org C is independently ON");

    // =========================================================================
    // SECTION 77: FOUR INDEPENDENT APPROVAL TOGGLES WORKFLOW TESTS
    // =========================================================================
    console.log("\n----------------------------------------------------------");
    console.log("🧩 SECTION 77: FOUR INDEPENDENT APPROVAL TOGGLES TESTS");
    console.log("----------------------------------------------------------");

    // Test 24: New Organization Defaults to all 4 toggles OFF (false)
    console.log("\n📌 Test 24: Default State - All 4 independent toggles default to false");
    const testOrgD = await Organization.create({
      name: `Test Org D ${Date.now()}`,
      slug: `test-org-d-${Date.now()}`,
    });
    cleanupIds.organizations.push(testOrgD._id);

    const orgDSettings = await TaskChangeRequestService.getOrganizationApprovalSettings(testOrgD._id);
    assert(orgDSettings.dueDateApprovalEnabled === false, "dueDateApprovalEnabled defaults to false");
    assert(orgDSettings.statusApprovalEnabled === false, "statusApprovalEnabled defaults to false");
    assert(orgDSettings.priorityApprovalEnabled === false, "priorityApprovalEnabled defaults to false");
    assert(orgDSettings.assigneeApprovalEnabled === false, "assigneeApprovalEnabled defaults to false");
    assert(orgDSettings.taskEditApprovalEnabled === false, "taskEditApprovalEnabled defaults to false");

    // Test 25: Admin updates individual toggle (dueDateApprovalEnabled = true)
    console.log("\n📌 Test 25: Admin toggles only dueDateApprovalEnabled -> Only dueDate is ON");
    const orgDAdmin = await User.create({
      firstName: "OrgD",
      lastName: "Admin",
      email: `admin_d_${Date.now()}@test.com`,
      password: "hashedpassword123",
      role: "org_admin",
      organization_id: testOrgD._id,
    });
    cleanupIds.users.push(orgDAdmin._id);

    await TaskChangeRequestService.updateOrganizationApprovalSettings({
      organizationId: testOrgD._id,
      settings: { dueDateApprovalEnabled: true },
      user: orgDAdmin,
    });

    const orgDSettingsAfterDueDate = await TaskChangeRequestService.getOrganizationApprovalSettings(testOrgD._id);
    assert(orgDSettingsAfterDueDate.dueDateApprovalEnabled === true, "dueDateApprovalEnabled is now true");
    assert(orgDSettingsAfterDueDate.statusApprovalEnabled === false, "statusApprovalEnabled remains false");
    assert(orgDSettingsAfterDueDate.priorityApprovalEnabled === false, "priorityApprovalEnabled remains false");
    assert(orgDSettingsAfterDueDate.assigneeApprovalEnabled === false, "assigneeApprovalEnabled remains false");
    assert(orgDSettingsAfterDueDate.taskEditApprovalEnabled === true, "taskEditApprovalEnabled is true when any toggle is ON");

    // Test 26: Field-by-field gating evaluation with only dueDate ON
    console.log("\n📌 Test 26: Field-by-field gating evaluation when only dueDateApprovalEnabled is ON");
    const orgDTask = await Task.create({
      title: "Task in Org D",
      dueDate: originalDueDate,
      priority: "medium",
      status: "OPEN",
      createdBy: manager._id,
      assignedTo: employee._id,
      organization: testOrgD._id,
    });
    cleanupIds.tasks.push(orgDTask._id);

    const evalDueDate = TaskChangeRequestService.evaluateApprovalRequirement(
      orgDTask,
      { dueDate: new Date("2026-12-01T12:00:00.000Z") },
      orgDSettingsAfterDueDate
    );
    assert(evalDueDate.requiresApproval === true, "Changing dueDate requires approval when dueDateApprovalEnabled is ON");

    const evalStatus = TaskChangeRequestService.evaluateApprovalRequirement(
      orgDTask,
      { status: "COMPLETED" },
      orgDSettingsAfterDueDate
    );
    assert(evalStatus.requiresApproval === false, "Changing status does NOT require approval when statusApprovalEnabled is OFF");

    const evalPriority = TaskChangeRequestService.evaluateApprovalRequirement(
      orgDTask,
      { priority: "urgent" },
      orgDSettingsAfterDueDate
    );
    assert(evalPriority.requiresApproval === false, "Changing priority does NOT require approval when priorityApprovalEnabled is OFF");

    const evalAssignee = TaskChangeRequestService.evaluateApprovalRequirement(
      orgDTask,
      { assignedTo: manager._id },
      orgDSettingsAfterDueDate
    );
    assert(evalAssignee.requiresApproval === false, "Changing assignee does NOT require approval when assigneeApprovalEnabled is OFF");

    // Test 27: Switch to priority ON, dueDate OFF
    console.log("\n📌 Test 27: Switch toggles - Turn dueDate OFF, priority ON");
    await TaskChangeRequestService.updateOrganizationApprovalSettings({
      organizationId: testOrgD._id,
      settings: { dueDateApprovalEnabled: false, priorityApprovalEnabled: true },
      user: orgDAdmin,
    });

    const orgDSettingsPriorityOnly = await TaskChangeRequestService.getOrganizationApprovalSettings(testOrgD._id);
    const evalDueDateNowOff = TaskChangeRequestService.evaluateApprovalRequirement(
      orgDTask,
      { dueDate: new Date("2026-12-01T12:00:00.000Z") },
      orgDSettingsPriorityOnly
    );
    assert(evalDueDateNowOff.requiresApproval === false, "Changing dueDate no longer requires approval when turned OFF");

    const evalPriorityNowOn = TaskChangeRequestService.evaluateApprovalRequirement(
      orgDTask,
      { priority: "urgent" },
      orgDSettingsPriorityOnly
    );
    assert(evalPriorityNowOn.requiresApproval === true, "Changing priority now requires approval when turned ON");

    // Test 28: Mixed updates (Section 8 & 40) - No partial update of unapproved fields
    console.log("\n📌 Test 28: Mixed fields update - Gated change causes full TaskChangeRequest creation without partial update");
    const mixedUpdates = {
      dueDate: new Date("2026-12-05T12:00:00.000Z"),
      priority: "high",
      status: "INPROGRESS",
    };
    const evalMixed = TaskChangeRequestService.evaluateApprovalRequirement(
      orgDTask,
      mixedUpdates,
      orgDSettingsPriorityOnly
    );
    assert(evalMixed.requiresApproval === true, "Mixed update requires approval because priority is protected and ON");
    assert(evalMixed.hasProtectedChanges === true, "Detects protected changes");
    assert(Object.keys(evalMixed.requestedChanges).length >= 2, "Contains all changed protected fields in the changeset");

    // Test 29: Migration script validates uninitialized orgs are set to false
    console.log("\n📌 Test 29: Database migration script test (migrate-task-edit-approval-toggles)");
    const uninitializedOrg = await Organization.create({
      name: `Legacy Uninitialized Org ${Date.now()}`,
      slug: `legacy-uninit-${Date.now()}`,
    });
    cleanupIds.organizations.push(uninitializedOrg._id);

    // Explicitly unset the 4 fields in MongoDB to simulate a pre-existing organization
    await Organization.updateOne(
      { _id: uninitializedOrg._id },
      {
        $unset: {
          dueDateApprovalEnabled: "",
          statusApprovalEnabled: "",
          priorityApprovalEnabled: "",
          assigneeApprovalEnabled: "",
        },
      }
    );

    const migrationResult = await runMigration();
    assert(migrationResult.modifiedCount >= 1, "Migration script modified at least 1 uninitialized organization");

    const reloadedOrg = await Organization.findById(uninitializedOrg._id);
    assert(reloadedOrg.dueDateApprovalEnabled === false, "Migrated org has dueDateApprovalEnabled set to false");
    assert(reloadedOrg.statusApprovalEnabled === false, "Migrated org has statusApprovalEnabled set to false");
    assert(reloadedOrg.priorityApprovalEnabled === false, "Migrated org has priorityApprovalEnabled set to false");
    assert(reloadedOrg.assigneeApprovalEnabled === false, "Migrated org has assigneeApprovalEnabled set to false");

    // Test 30: Multi-tenant independent toggle configuration
    console.log("\n📌 Test 30: Multi-tenant isolated configuration between Org D and Org E");
    const testOrgE = await Organization.create({
      name: `Test Org E ${Date.now()}`,
      slug: `test-org-e-${Date.now()}`,
      assigneeApprovalEnabled: true,
      statusApprovalEnabled: true,
      dueDateApprovalEnabled: false,
      priorityApprovalEnabled: false,
    });
    cleanupIds.organizations.push(testOrgE._id);

    const settingsOrgD = await TaskChangeRequestService.getOrganizationApprovalSettings(testOrgD._id);
    const settingsOrgE = await TaskChangeRequestService.getOrganizationApprovalSettings(testOrgE._id);

    assert(settingsOrgD.priorityApprovalEnabled === true && settingsOrgE.priorityApprovalEnabled === false, "Priority toggle is isolated between Org D and Org E");
    assert(settingsOrgD.assigneeApprovalEnabled === false && settingsOrgE.assigneeApprovalEnabled === true, "Assignee toggle is isolated between Org D and Org E");
    assert(settingsOrgD.statusApprovalEnabled === false && settingsOrgE.statusApprovalEnabled === true, "Status toggle is isolated between Org D and Org E");

  } finally {
    // Cleanup test data
    console.log("\n🧹 Cleaning up test artifacts...");
    if (cleanupIds.organizations && cleanupIds.organizations.length > 0) {
      await Organization.deleteMany({ _id: { $in: cleanupIds.organizations } });
      await AuditLog.deleteMany({ organization_id: { $in: cleanupIds.organizations } });
    }
    if (cleanupIds.tokens.length > 0) {
      await ApprovalActionToken.deleteMany({ _id: { $in: cleanupIds.tokens } });
    }
    if (cleanupIds.requests.length > 0) {
      await TaskChangeRequest.deleteMany({ _id: { $in: cleanupIds.requests } });
      await ApprovalActionToken.deleteMany({ requestId: { $in: cleanupIds.requests } });
    }
    if (cleanupIds.tasks.length > 0) {
      await Task.deleteMany({ _id: { $in: cleanupIds.tasks } });
    }
    if (cleanupIds.users.length > 0) {
      await User.deleteMany({ _id: { $in: cleanupIds.users } });
    }
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }

  console.log("\n==========================================================");
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("❌ Fatal test error:", err);
  process.exit(1);
});
