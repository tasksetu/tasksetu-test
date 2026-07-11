import { User } from "../modals/userModal.js";
import { WhatsappSession } from "../modals/whatsappSessionModal.js";
import Task from "../modals/taskModal.js";
import { QuickTask } from "../modals/quickTaskModal.js";
import { sendWhatsAppText } from "../services/whatsappService.js";
import { TimezoneHelper } from "../utils/timezoneHelper.js";

// GET webhook verification handler
export const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "tasksetu_verify_token";

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("✅ WhatsApp Webhook verified successfully");
      return res.status(200).send(challenge);
    } else {
      console.warn("⚠️ WhatsApp Webhook verification failed: Token mismatch");
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
};

// POST webhook incoming message handler
export const handleWebhook = async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    // Always respond 200 immediately to WhatsApp/Meta to acknowledge receipt
    res.status(200).send("EVENT_RECEIVED");

    if (!message) return;

    const from = message.from; // E.g., "918576834748"
    const text = message.text?.body?.trim();
    if (!text) return;

    console.log(`📱 WhatsApp incoming message from ${from}: "${text}"`);

    const cleanFrom = from.replace(/\D/g, "");

    // 1. Find matching verified user in DB (ends with 10 digit suffix or exact match)
    const users = await User.find({ phoneVerified: true });
    const user = users.find((u) => {
      const cleanU = (u.phone || "").replace(/\D/g, "");
      return cleanU && (cleanFrom.endsWith(cleanU) || cleanU.endsWith(cleanFrom));
    });

    if (!user) {
      await sendWhatsAppText(
        from,
        "👋 Welcome to TaskSetu!\n\nPlease register and verify your phone number in your Profile settings to use the WhatsApp work assistant."
      );
      return;
    }

    // 2. Fetch or create conversational session
    let session = await WhatsappSession.findOne({ phone: cleanFrom });
    if (!session) {
      session = await WhatsappSession.create({ phone: cleanFrom, user: user._id });
    }

    const command = text.toLowerCase();

    // 3. Main Menu / Reset State Trigger
    const isGreeting = 
      /^(hi+|hello|hey|helo|hola|menu|help|0|start)$/i.test(command) ||
      command.startsWith("hi") || 
      command.startsWith("hello") || 
      command.startsWith("hey");

    if (isGreeting) {
      session.currentStep = "idle";
      session.tempData = {};
      await session.save();

      const menuMsg = 
        `👋 *Welcome to TaskSetu*\n` +
        `Your work assistant on WhatsApp\n\n` +
        `Please reply with an option number:\n\n` +
        `1️⃣ *Today's Tasks*\n` +
        `2️⃣ *Overdue Tasks*\n` +
        `3️⃣ *Create a Quick Task*\n` +
        `4️⃣ *Create a Regular Task*\n\n` +
        `💡 Reply *0* anytime to return to this menu.`;

      await sendWhatsAppText(from, menuMsg);
      return;
    }

    // 4. Conversational State Machine
    switch (session.currentStep) {
      case "idle": {
        if (text === "1") {
          let userTimezone = await TimezoneHelper.getUserTimezone(user._id);
          if (userTimezone === "UTC") userTimezone = "Asia/Kolkata";
          const local = TimezoneHelper.getLocalTime(userTimezone);
          const startOfToday = new Date(Date.UTC(local.year, local.month - 1, local.dayOfMonth, 0, 0, 0, 0));
          const endOfToday = new Date(Date.UTC(local.year, local.month - 1, local.dayOfMonth, 23, 59, 59, 999));

          const tasks = await Task.find({
            $or: [{ assignedTo: user._id }, { createdBy: user._id }],
            is_deleted: { $ne: true },
            dueDate: { $gte: startOfToday, $lte: endOfToday },
            status: { $nin: ["DONE", "CANCELLED", "COMPLETED", "completed"] },
          });

          if (tasks.length === 0) {
            await sendWhatsAppText(from, "🗓️ *Today's Tasks*\n\nYou have no pending tasks due today.\n\n↩️ Reply *0* for the Main Menu.");
          } else {
            let list = `🗓️ *Today's Tasks*\n\n`;
            tasks.forEach((t, i) => {
              const utcH = t.dueDate ? t.dueDate.getUTCHours() : 0;
              const utcM = t.dueDate ? t.dueDate.getUTCMinutes() : 0;
              const ampm = utcH >= 12 ? "PM" : "AM";
              const hour12 = utcH % 12 || 12;
              const minStr = utcM.toString().padStart(2, "0");
              const formattedTime = `${hour12}:${minStr} ${ampm}`;
              list += `${i + 1}. *${t.title}* (${t.status}) (Due: ${formattedTime})\n`;
            });
            list += `\n↩️ Reply *0* for the Main Menu.`;
            await sendWhatsAppText(from, list);
          }
        } else if (text === "2") {
          let userTimezone = await TimezoneHelper.getUserTimezone(user._id);
          if (userTimezone === "UTC") userTimezone = "Asia/Kolkata";
          const local = TimezoneHelper.getLocalTime(userTimezone);
          const localNowAsUtc = new Date(Date.UTC(
            local.year,
            local.month - 1,
            local.dayOfMonth,
            local.hours,
            local.minutes,
            local.seconds
          ));

          const tasks = await Task.find({
            $or: [{ assignedTo: user._id }, { createdBy: user._id }],
            is_deleted: { $ne: true },
            dueDate: { $lt: localNowAsUtc },
            status: { $nin: ["DONE", "CANCELLED", "COMPLETED", "completed"] },
          });

          if (tasks.length === 0) {
            await sendWhatsAppText(from, "⚠️ *Overdue Tasks*\n\nNo overdue tasks found.\n\n↩️ Reply *0* for the Main Menu.");
          } else {
            let list = `⚠️ *Overdue Tasks*\n\n`;
            tasks.forEach((t, i) => {
              const day = t.dueDate ? t.dueDate.getUTCDate() : 1;
              const month = t.dueDate ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][t.dueDate.getUTCMonth()] : "Jan";
              const year = t.dueDate ? t.dueDate.getUTCFullYear() : 2026;
              const utcH = t.dueDate ? t.dueDate.getUTCHours() : 0;
              const utcM = t.dueDate ? t.dueDate.getUTCMinutes() : 0;
              const ampm = utcH >= 12 ? "pm" : "am";
              const hour12 = utcH % 12 || 12;
              const minStr = utcM.toString().padStart(2, "0");
              const formattedDate = `${day} ${month} ${year}, ${hour12}:${minStr} ${ampm}`;
              list += `• *${t.title}* (Due: ${formattedDate})\n`;
            });
            list += `\n↩️ Reply *0* for the Main Menu.`;
            await sendWhatsAppText(from, list);
          }
        } else if (text === "3") {
          session.currentStep = "awaiting_quick_task_title";
          await session.save();
          await sendWhatsAppText(from, "⚡ *Create a Quick Task*\n\nPlease reply with the task title.");
        } else if (text === "4") {
          session.currentStep = "awaiting_regular_task_title";
          await session.save();
          await sendWhatsAppText(from, "📝 *Create a Regular Task*\n\nPlease reply with the task title.");
        } else {
          await sendWhatsAppText(
            from,
            "⚠️ Invalid option. Please reply with *1*, *2*, *3*, or *4*.\n\nReply *0* to return to the Main Menu."
          );
        }
        break;
      }

      case "awaiting_quick_task_title": {
        if (!text) {
          await sendWhatsAppText(from, "⚠️ Title cannot be empty. Please enter a valid task title.");
          return;
        }

        await QuickTask.create({
          title: text,
          user: user._id,
          organization: user.organization_id,
        });

        session.currentStep = "idle";
        session.tempData = {};
        await session.save();

        await sendWhatsAppText(
          from,
          `✅ *Quick Task Created!*\n\n` +
          `Title: *${text}*\n` +
          `Due: Today\n\n` +
          `↩️ Reply *0* for the Main Menu.`
        );
        break;
      }

      case "awaiting_regular_task_title": {
        if (!text) {
          await sendWhatsAppText(from, "⚠️ Title cannot be empty. Please enter a valid task title.");
          return;
        }

        session.tempData = { title: text };
        session.currentStep = "awaiting_regular_task_date";
        await session.save();

        await sendWhatsAppText(
          from,
          `🗓️ *Set Due Date*\n\n` +
          `Please reply with the due date in *YYYY-MM-DD* format (e.g. 2026-07-12) or reply 'today' / 'tomorrow'.`
        );
        break;
      }

      case "awaiting_regular_task_date": {
        const userTimezone = await TimezoneHelper.getUserTimezone(user._id);
        let dateStr = "";
        const input = text.toLowerCase();

        if (input === "today") {
          dateStr = TimezoneHelper.formatDateInTimezone(new Date(), userTimezone);
        } else if (input === "tomorrow") {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          dateStr = TimezoneHelper.formatDateInTimezone(tomorrow, userTimezone);
        } else {
          // Validate YYYY-MM-DD format
          const parts = text.split("-");
          if (parts.length === 3) {
            const date = new Date(text);
            if (!isNaN(date.getTime())) {
              dateStr = text; // Match original input format
            }
          }
        }

        if (!dateStr) {
          await sendWhatsAppText(
            from,
            "⚠️ Invalid date format.\n\nPlease reply with *YYYY-MM-DD* (e.g. 2026-07-12) or reply 'today' / 'tomorrow'."
          );
          return;
        }

        // Store parsed date string (YYYY-MM-DD) and progress to time step
        session.tempData = {
          title: session.tempData?.title,
          dueDateStr: dateStr
        };
        session.currentStep = "awaiting_regular_task_time";
        await session.save();

        await sendWhatsAppText(
          from,
          `⏰ *Set Due Time*\n\n` +
          `Please reply with the time in 24-hour format (e.g. *14:30* or *18:00*) or reply 'skip' to set no specific time.`
        );
        break;
      }

      case "awaiting_regular_task_time": {
        const input = text.toLowerCase();
        const taskTitle = session.tempData?.title || "Regular Task via WhatsApp";
        const dateStr = session.tempData?.dueDateStr || TimezoneHelper.formatDateInTimezone(new Date(), "UTC");
        let finalDueDate;

        if (input !== "skip" && input !== "no") {
          // Parse HH:MM format
          const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
          const match = text.match(timeRegex);
          if (!match) {
            await sendWhatsAppText(
              from,
              "⚠️ Invalid time format.\n\nPlease reply with the time in 24-hour format (e.g. *14:30* or *18:00*) or reply 'skip'."
            );
            return;
          }
          const timeStr = `${match[1].padStart(2, '0')}:${match[2]}:00`;
          // Save exactly as local time value in UTC
          finalDueDate = new Date(`${dateStr}T${timeStr}Z`);
        } else {
          // Default to end of day if skipped
          finalDueDate = new Date(`${dateStr}T23:59:59Z`);
        }

        await Task.create({
          title: taskTitle,
          createdBy: user._id,
          assignedTo: user._id,
          dueDate: finalDueDate,
          status: "OPEN",
          priority: "medium",
          organization: user.organization_id,
          taskType: "regular",
          createdByRole: Array.isArray(user.role) ? user.role : [user.role || "employee"],
        });

        session.currentStep = "idle";
        session.tempData = {};
        await session.save();

        const day = finalDueDate.getUTCDate();
        const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][finalDueDate.getUTCMonth()];
        const year = finalDueDate.getUTCFullYear();
        const utcH = finalDueDate.getUTCHours();
        const utcM = finalDueDate.getUTCMinutes();
        const ampm = utcH >= 12 ? "PM" : "AM";
        const hour12 = utcH % 12 || 12;
        const minStr = utcM.toString().padStart(2, "0");
        const formattedDateTime = `${day} ${month} ${year}, ${hour12}:${minStr} ${ampm}`;

        await sendWhatsAppText(
          from,
          `✅ *Regular Task Created!*\n\n` +
          `Title: *${taskTitle}*\n` +
          `Due: ${formattedDateTime}\n\n` +
          `↩️ Reply *0* for the Main Menu.`
        );
        break;
      }

      default: {
        session.currentStep = "idle";
        session.tempData = {};
        await session.save();
        await sendWhatsAppText(from, "Something went wrong. Returning to the main menu.\n\nReply *0* to load the menu.");
        break;
      }
    }
  } catch (err) {
    console.error("❌ Error in WhatsApp webhook handler:", err);
  }
};
