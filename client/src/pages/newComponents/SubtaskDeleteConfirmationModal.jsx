import React from "react";
import CustomConfirmationModal from "./CustomConfirmationModal";

const SubtaskDeleteConfirmationModal = ({ subtaskTitle, onConfirm, onCancel }) => {
    return (
        <CustomConfirmationModal
            isOpen={true}
            onClose={onCancel}
            onConfirm={onConfirm}
            type="danger"
            title="Delete Subtask"
            message={`Are you sure you want to delete the subtask "${subtaskTitle}"? This action cannot be undone.`}
            confirmText="Delete Subtask"
            cancelText="Cancel"
        />
    );
};

export default SubtaskDeleteConfirmationModal;