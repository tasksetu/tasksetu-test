/**
 * RecipientVariableMatrixModal — Interactive Recipient Variable Matrix (Case I & Case II)
 *
 * Allows users to set or manually override custom variable values (e.g. {Link}, {ExpectedCTC})
 * per recipient in an interactive spreadsheet-like grid view.
 */

import React, { useState, useEffect } from "react";
import {
  Table,
  Sparkles,
  Trash2,
  Save,
  Info,
  X,
  UserCheck,
  FormInput,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function RecipientVariableMatrixModal({
  isOpen,
  onClose,
  recipients = [],
  variables = [],
  onSaveMatrix,
}) {
  // Matrix state: array of recipients with local variables object
  const [matrixRecipients, setMatrixRecipients] = useState([]);

  useEffect(() => {
    if (isOpen) {
      // Clone recipients array and normalize variables map to plain JS object
      const cloned = recipients.map((r) => {
        let varsObj = {};
        if (r.variables) {
          if (typeof r.variables.toObject === "function") {
            varsObj = r.variables.toObject();
          } else if (r.variables instanceof Map) {
            varsObj = Object.fromEntries(r.variables.entries());
          } else if (typeof r.variables === "object") {
            varsObj = { ...r.variables };
          }
        }
        return {
          ...r,
          variables: varsObj,
        };
      });
      setMatrixRecipients(cloned);
    }
  }, [isOpen, recipients]);

  // Handle cell text change
  const handleCellChange = (recipientIndex, varKey, value) => {
    setMatrixRecipients((prev) => {
      const updated = [...prev];
      const target = { ...updated[recipientIndex] };
      target.variables = {
        ...(target.variables || {}),
        [varKey]: value,
      };
      updated[recipientIndex] = target;
      return updated;
    });
  };

  // Copy top row's cell value down to all rows for a column
  const handleCopyDown = (varKey) => {
    if (matrixRecipients.length === 0) return;
    const topValue = matrixRecipients[0].variables?.[varKey] || "";
    setMatrixRecipients((prev) =>
      prev.map((r) => ({
        ...r,
        variables: {
          ...(r.variables || {}),
          [varKey]: topValue,
        },
      })),
    );
  };

  // Clear all values for a column
  const handleClearColumn = (varKey) => {
    setMatrixRecipients((prev) =>
      prev.map((r) => {
        const nextVars = { ...(r.variables || {}) };
        delete nextVars[varKey];
        return {
          ...r,
          variables: nextVars,
        };
      }),
    );
  };

  const handleSave = () => {
    onSaveMatrix(matrixRecipients);
    onClose();
  };

  // Filter valid user-defined variables
  const validVariables = (variables || []).filter((v) => v && v.key && v.key.trim() !== "");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white text-gray-900 shadow-2xl rounded-xl border border-gray-200 [&>button]:text-white [&>button]:opacity-90 hover:[&>button]:opacity-100 hover:[&>button]:text-white">
        {/* Header */}
        <DialogHeader className="p-5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex flex-row items-center justify-between pr-10">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
              <Table className="w-5 h-5 text-blue-300" />
              Recipient Variable Matrix & Form Field Overrides
            </DialogTitle>
            <DialogDescription className="text-blue-100 text-xs mt-1">
              Configure per-recipient variable values (Case I: Manual Entry & Case II: Form Response Overrides)
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Info Banner */}
        <div className="bg-blue-50/80 border-b border-blue-100 px-5 py-3 flex items-start gap-3 text-xs text-blue-800">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-0.5">How Variable Matrix Works:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-blue-700">
              <li>
                <strong>Case I (Manual Entry):</strong> Type values into cells for variables like <code className="bg-blue-100 px-1 rounded">&#123;Link&#123;</code> or <code className="bg-blue-100 px-1 rounded">&#123;Link_Text&#123;</code>.
              </li>
              <li>
                <strong>Case II (Form Entry):</strong> Form response data appears pre-filled. You can manually click any cell and edit or override values directly (e.g. custom CTC or status).
              </li>
            </ul>
          </div>
        </div>

        {/* Body Content / Grid Table */}
        <div className="flex-1 overflow-auto p-5">
          {matrixRecipients.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <UserCheck className="w-10 h-10 mx-auto text-gray-400 mb-2" />
              <p className="font-medium text-sm text-gray-700">No Recipients Added Yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Please add recipients in the main form first before editing variable matrix.
              </p>
            </div>
          ) : validVariables.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <FormInput className="w-10 h-10 mx-auto text-gray-400 mb-2" />
              <p className="font-medium text-sm text-gray-700">No Template Variables Defined</p>
              <p className="text-xs text-gray-500 mt-1">
                Click "+ Add Variable" in the form to define template variables (e.g., <code className="bg-gray-200 px-1 rounded">&#123;Link&#123;</code>, <code className="bg-gray-200 px-1 rounded">&#123;ExpectedCTC&#123;</code>).
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 font-semibold uppercase tracking-wider">
                    <th className="p-3 w-12 text-center bg-gray-100 sticky left-0 z-20 border-r border-gray-200">#</th>
                    <th className="p-3 min-w-[160px] bg-gray-100 sticky left-12 z-20 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">Recipient Name</th>
                    <th className="p-3 min-w-[180px] bg-gray-100 border-r border-gray-200">Email Address</th>
                    {validVariables.map((v) => (
                      <th key={v.key} className="p-3 min-w-[200px] border-r border-gray-200 bg-blue-50/50">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-mono text-blue-700 font-bold lowercase text-xs">
                            &#123;{v.key}&#125;
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyDown(v.key)}
                              className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
                              title="Copy top cell down to all rows"
                            >
                              <Sparkles className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleClearColumn(v.key)}
                              className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Clear all values in this column"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {v.staticValue && (
                          <div className="text-[10px] text-gray-400 font-normal truncate">
                            Default: {v.staticValue}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {matrixRecipients.map((rec, rIdx) => (
                    <tr key={rIdx} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3 text-center text-gray-400 font-mono text-xs bg-gray-50 sticky left-0 z-10 border-r border-gray-200">
                        {rIdx + 1}
                      </td>
                      <td className="p-3 font-medium text-gray-900 bg-white sticky left-12 z-10 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{rec.name || "—"}</span>
                          {rec.source === "form_submission" && (
                            <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-100 text-emerald-800 rounded">
                              Form
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-gray-600 border-r border-gray-200 truncate">
                        {rec.email}
                      </td>
                      {validVariables.map((v) => {
                        const getVarValue = (varsObj, targetKey) => {
                          if (!varsObj || typeof varsObj !== "object" || !targetKey) return "";
                          if (varsObj[targetKey] !== undefined && varsObj[targetKey] !== null) return String(varsObj[targetKey]);
                          const cleanTarget = String(targetKey).toLowerCase().replace(/[^a-z0-9]/g, "");
                          for (const [k, val] of Object.entries(varsObj)) {
                            const cleanK = String(k).toLowerCase().replace(/[^a-z0-9]/g, "");
                            if (cleanK === cleanTarget && val !== undefined && val !== null) {
                              return String(val);
                            }
                          }
                          return "";
                        };
                        const cellVal = getVarValue(rec.variables, v.key);
                        return (
                          <td key={v.key} className="p-2 border-r border-gray-200">
                            <input
                              type="text"
                              value={cellVal}
                              onChange={(e) => handleCellChange(rIdx, v.key, e.target.value)}
                              placeholder={v.staticValue || `Value for ${rec.name || "user"}`}
                              className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Showing {matrixRecipients.length} recipients & {validVariables.length} variables
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs px-4 py-2">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-5 py-2 font-medium flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Save Matrix & Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
