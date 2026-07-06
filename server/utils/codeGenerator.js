import { FormTemplate } from '../modals/formTemplateModal.js';

/**
 * Generates a unique code with prefix and random numbers
 * @param {string} prefix - Prefix for the code (e.g., 'FORM')
 * @returns {Promise<string>} - Returns a unique code
 */
export const generateUniqueCode = async (prefix) => {
    let isUnique = false;
    let code;

    while (!isUnique) {
        // Generate a random 6-digit number
        const random = Math.floor(100000 + Math.random() * 900000);
        code = `${prefix}-${random}`;

        // Check if code exists
        const existingForm = await FormTemplate.findOne({ form_code: code });
        if (!existingForm) {
            isUnique = true;
        }
    }

    return code;
};