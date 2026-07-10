import axios from "axios";

/**
 * Sends a WhatsApp notification using a template.
 * @param {string} phone - Target phone number (e.g. "+91 98765 43210" or "919876543210")
 * @param {string} templateName - Name of the WhatsApp template (defaults to "hello_world")
 * @param {string} languageCode - Language code for the template (defaults to "en_US")
 * @param {Array} components - Optional components for parameter substitution in template
 * @returns {Promise<Object>} API response data
 */
export const sendWhatsApp = async (phone, templateName = "hello_world", languageCode = "en_US", components = []) => {
  try {
    if (!phone) {
      throw new Error("Phone number is required to send WhatsApp notifications");
    }

    const apiVersion = process.env.WHATSAPP_API_VERSION || "v25.0";
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in env configuration");
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    // Sanitize phone: keep only numbers (WhatsApp Cloud API requires country code + number with no spaces, plus sign or formatting)
    const cleanPhone = phone.replace(/\D/g, "");

    const payload = {
      messaging_product: "whatsapp",
      to: cleanPhone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
      },
    };

    if (components && components.length > 0) {
      payload.template.components = components;
    }

    console.log(`[WhatsAppService] Sending template '${templateName}' to ${cleanPhone}`);

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("[WhatsAppService] WhatsApp sent successfully:", response.data);
    return response.data;
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error("[WhatsAppService] WhatsApp Error:", errorData);
    throw new Error(
      typeof errorData === "object"
        ? JSON.stringify(errorData)
        : errorData
    );
  }
};

/**
 * Sends a direct text message on WhatsApp (Note: only valid during an active 24h customer window).
 * @param {string} phone - Target phone number
 * @param {string} messageText - The body text
 * @returns {Promise<Object>} API response data
 */
export const sendWhatsAppText = async (phone, messageText) => {
  try {
    if (!phone || !messageText) {
      throw new Error("Phone number and message text are required");
    }

    const apiVersion = process.env.WHATSAPP_API_VERSION || "v25.0";
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN in env configuration");
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const cleanPhone = phone.replace(/\D/g, "");

    const payload = {
      messaging_product: "whatsapp",
      to: cleanPhone,
      type: "text",
      text: {
        body: messageText,
      },
    };

    console.log(`[WhatsAppService] Sending text message to ${cleanPhone}`);

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("[WhatsAppService] WhatsApp Text sent successfully:", response.data);
    return response.data;
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error("[WhatsAppService] WhatsApp Text Error:", errorData);
    throw new Error(
      typeof errorData === "object"
        ? JSON.stringify(errorData)
        : errorData
    );
  }
};
