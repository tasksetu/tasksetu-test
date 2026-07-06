import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import {
  PlusCircle,
  MinusCircle,
  PenSquare,
  ArrowRight,
  User,
  Clock,
  Calendar,
  FileText,
  CheckCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
function safeToArray(val) {
  return Array.isArray(val) ? val : [];
}
function hydrateVersionWithFields(v, formId) {
  if (!v) return null;
  if (Array.isArray(v.fields) && v.fields.length) return v;
  const map = mockFormVersionDetails?.[formId] || {};
  // try by id, then by version string variants
  const byId = map[v.id];
  const byVersion = map[v.version] || map[`v${v.version}`];
  const details =
    byId ||
    byVersion ||
    mockFormVersionDetails[v.id] ||
    mockFormVersionDetails[v.version] ||
    mockFormVersionDetails[`v${v.version}`];
  return details ? { ...v, ...details } : v;
}
function formatValue(val) {
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}

function diffVersions(prev, curr) {
  const prevFields = safeToArray(prev?.fields);
  const currFields = safeToArray(curr?.fields);

  // If field-level data isn’t present, fallback to counts
  if (!prevFields.length && !currFields.length) {
    const added = curr?.changes?.added ?? 0;
    const removed = curr?.changes?.removed ?? 0;
    const modified = curr?.changes?.modified ?? 0;
    return {
      added,
      removed,
      modified,
      addedList: [],
      removedList: [],
      modifiedList: [],
    };
  }

  const prevMap = new Map(prevFields.map((f) => [f.id, f]));
  const currMap = new Map(currFields.map((f) => [f.id, f]));
  const addedList = [];
  const removedList = [];
  const modifiedList = [];

  for (const [id, f] of currMap) {
    if (!prevMap.has(id)) {
      addedList.push({ id, label: f.label, type: f.type });
    } else {
      const pf = prevMap.get(id);
      const changes = {};
      [
        "label",
        "type",
        "required",
        "placeholder",
        "options",
        "pattern",
      ].forEach((k) => {
        const before = pf?.[k];
        const after = f?.[k];
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          changes[k] = { from: before, to: after };
        }
      });
      if (Object.keys(changes).length) {
        modifiedList.push({
          id,
          label: f.label,
          prevLabel: pf?.label,
          type: f.type,
          prevType: pf?.type,
          changes,
        });
      }
    }
  }

  for (const [id, f] of prevMap) {
    if (!currMap.has(id)) {
      removedList.push({ id, label: f.label, type: f.type });
    }
  }

  return {
    added: addedList.length,
    removed: removedList.length,
    modified: modifiedList.length,
    addedList,
    removedList,
    modifiedList,
  };
}

export function FormVersionDetailsDialog({
  open,
  onOpenChange,
  version,
  versions,
  baseline = "previous",
  formId,
}) {
  const [activeTab, setActiveTab] = useState("changes");

  const { prevVersion, diff, currentVersion } = useMemo(() => {
    if (!version) {
      return {
        prevVersion: null,
        currentVersion: null,
        diff: {
          added: 0,
          removed: 0,
          modified: 0,
          addedList: [],
          removedList: [],
          modifiedList: [],
        },
      };
    }

    let prev = null;
    if (baseline === "previous") {
      const idx = versions?.findIndex((v) => v.id === version.id) ?? -1;
      prev = idx >= 0 ? versions[idx + 1] : null; // assumes versions sorted desc
    } else if (baseline === "published") {
      const createdAtTs = new Date(version.createdAt).getTime();
      prev =
        versions
          ?.filter(
            (v) =>
              v.status === "published" &&
              new Date(v.createdAt).getTime() < createdAtTs,
          )
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] ||
        null;
    }

    const hydratedCurr = hydrateVersionWithFields(version, formId);
    const hydratedPrev = hydrateVersionWithFields(prev, formId);

    return {
      prevVersion: hydratedPrev,
      currentVersion: hydratedCurr,
      diff: diffVersions(hydratedPrev, hydratedCurr),
    };
  }, [version, versions, baseline, formId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader className="pb-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Version v{version?.version}
              </DialogTitle>
              <p className="text-sm text-gray-600 mt-1">
                Comparing to{" "}
                {baseline === "published" ? "last published" : "previous"}{" "}
                version
                {prevVersion ? ` (v${prevVersion.version})` : ""}
              </p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-sm bg-green-50 border border-green-200">
              <PlusCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                {diff.added} Added
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-sm bg-red-50 border border-red-200">
              <MinusCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">
                {diff.removed} Removed
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-sm bg-amber-50 border border-amber-200">
              <PenSquare className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                {diff.modified} Modified
              </span>
            </div>
          </div>
        </DialogHeader>

        {!version ? (
          <div className="text-center py-8 text-gray-500">
            No version selected.
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="changes" className="flex items-center gap-2">
                <PenSquare className="h-4 w-4" />
                Changes
              </TabsTrigger>
              <TabsTrigger value="meta" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Details
              </TabsTrigger>
            </TabsList>

            <TabsContent value="changes" className="mt-6">
              <div className="space-y-3">
                {/* Unified change list */}
                <div className="space-y-3">
                  {/* Added changes */}
                  {diff.addedList.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-green-700">
                        <PlusCircle className="h-4 w-4" />
                        Added Fields ({diff.added})
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {diff.addedList.map((item) => (
                          <div
                            key={`a-${item.id}`}
                            className="flex items-center gap-3 p-3 rounded-sm bg-green-50 border-l-4 border-green-400"
                          >
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                <PlusCircle className="h-4 w-4 text-green-600" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {item.label}
                              </p>
                              <p className="text-xs text-gray-600">
                                Type: {item.type}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Removed changes */}
                  {diff.removedList.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-red-700">
                        <MinusCircle className="h-4 w-4" />
                        Removed Fields ({diff.removed})
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {diff.removedList.map((item) => (
                          <div
                            key={`r-${item.id}`}
                            className="flex items-center gap-3 p-3 rounded-sm bg-red-50 border-l-4 border-red-400"
                          >
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                                <MinusCircle className="h-4 w-4 text-red-600" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {item.label}
                              </p>
                              <p className="text-xs text-gray-600">
                                Type: {item.type}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Modified changes */}
                  {diff.modifiedList.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                        <PenSquare className="h-4 w-4" />
                        Modified Fields ({diff.modified})
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {diff.modifiedList.map((item) => (
                          <div
                            key={`m-${item.id}`}
                            className="p-4 rounded-sm bg-amber-50 border-l-4 border-amber-400"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0">
                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                  <PenSquare className="h-4 w-4 text-amber-600" />
                                </div>
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="text-sm font-medium text-gray-900">
                                  {item.label !== item.prevLabel ? (
                                    <div className="flex items-center gap-2">
                                      <span className="line-through text-gray-500">
                                        {item.prevLabel}
                                      </span>
                                      <ArrowRight className="h-3 w-3 text-gray-400" />
                                      <span>{item.label}</span>
                                    </div>
                                  ) : (
                                    item.label
                                  )}
                                </div>

                                <div className="space-y-1">
                                  <span className="ml-2 text-xs text-gray-600">
                                    Type: {item.type}
                                  </span>
                                  {Object.entries(item.changes).map(
                                    ([key, change]) => (
                                      <div
                                        key={key}
                                        className="flex items-center gap-2 text-xs"
                                      >
                                        <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 font-medium capitalize">
                                          {key}
                                        </span>
                                        <span className="px-2 py-1 rounded bg-red-100 text-red-700 line-through">
                                          {formatValue(change.from)}
                                        </span>
                                        <ArrowRight className="h-3 w-3 text-gray-400" />
                                        <span className="px-2 py-1 rounded bg-green-100 text-green-700 font-medium">
                                          {formatValue(change.to)}
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {diff.removedList.length === 0 &&
                    diff.addedList.length === 0 &&
                    diff.modifiedList.length === 0 && (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-sm">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>
                          {Array.isArray(currentVersion?.fields)
                            ? "No changes from baseline."
                            : "No field-level data available."}
                        </p>
                      </div>
                    )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="meta" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Version Info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Version Information
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500">Status</p>
                        <p className="text-sm font-medium">
                          <Badge
                            variant={
                              version?.status === "published"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {version?.status}
                          </Badge>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500">Notes</p>
                        <p className="text-sm text-gray-900">
                          {version?.notes || "No notes provided"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Timeline
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500">Created</p>
                        <p className="text-sm text-gray-900">
                          {version?.createdAt
                            ? new Date(version.createdAt).toLocaleString()
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {version?.publishedAt && (
                      <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Published</p>
                          <p className="text-sm text-gray-900">
                            {new Date(version.publishedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-purple-500 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500">Author</p>
                        <p className="text-sm text-gray-900">
                          {version?.createdBy?.name || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
