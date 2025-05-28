/**
 * Send waitlist confirmation email
 * 
 * @param {string} email - Client email address
 * @param {string} firstName - Client first name
 * @param {Object} data - Waitlist data
 * @returns {Promise<Object>} Email send result
 */
exports.sendWaitlistConfirmation = async (email, firstName, data) => {
  try {
    const { serviceName, requestedDate } = data;
    
    const formattedDate = formatDate(requestedDate);
    
    const html = `
      <h2>Waitlist Confirmation</h2>
      <p>Hello ${firstName},</p>
      <p>You have been added to the waitlist for ${serviceName} on ${formattedDate}.</p>
      <p>We will notify you as soon as a spot becomes available.</p>
      <p>Thank you for your patience.</p>
      <p>Best regards,<br/>Recovery Office Team</p>
    `;
    
    return await sendEmail({
      to: email,
      subject: `Waitlist Confirmation - ${serviceName}`,
      html
    });
  } catch (error) {
    logger.error(`Error sending waitlist confirmation email: ${error.message}`, { error });
    throw error;
  }
};

/**
 * Send waitlist notification email when a spot becomes available
 * 
 * @param {string} email - Client email address
 * @param {string} firstName - Client first name
 * @param {Object} data - Slot data
 * @returns {Promise<Object>} Email send result
 */
exports.sendWaitlistNotification = async (email, firstName, data) => {
  try {
    const { serviceName, date, timeSlot, bookingUrl } = data;
    
    const formattedDate = formatDate(date);
    
    const html = `
      <h2>Spot Available!</h2>
      <p>Hello ${firstName},</p>
      <p>Good news! A spot has opened up for the ${serviceName} service on ${formattedDate} at ${timeSlot}.</p>
      <p>Click the button below to secure your booking:</p>
      <a href="${bookingUrl}" style="background-color: #D4AF37; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0;">Book Now</a>
      <p>This spot is available on a first-come, first-served basis, so we recommend booking quickly.</p>
      <p>Best regards,<br/>Recovery Office Team</p>
    `;
    
    return await sendEmail({
      to: email,
      subject: `Spot Available for ${serviceName}`,
      html
    });
  } catch (error) {
    logger.error(`Error sending waitlist notification email: ${error.message}`, { error });
    throw error;
  }
};

/**
 * Send scheduled report email
 * 
 * @param {string} email - Recipient email address
 * @param {string} reportTitle - Report title
 * @param {Buffer} reportBuffer - Report file as buffer
 * @param {string} filename - Report filename
 * @param {string} mimeType - Report MIME type
 * @returns {Promise<Object>} Email send result
 */
exports.sendReportEmail = async (email, reportTitle, reportBuffer, filename, mimeType) => {
  try {
    const html = `
      <h2>Recovery Office Report</h2>
      <p>Please find attached your requested ${reportTitle}.</p>
      <p>This report was generated on ${formatDate(new Date())} at ${formatTime(new Date())}.</p>
      <p>Thank you for using our services.</p>
      <p>Best regards,<br/>Recovery Office Team</p>
    `;
    
    return await sendEmail({
      to: email,
      subject: `${reportTitle} - Recovery Office Report`,
      html,
      attachments: [
        {
          filename,
          content: reportBuffer,
          contentType: mimeType
        }
      ]
    });
  } catch (error) {
    logger.error(`Error sending report email: ${error.message}`, { error });
    throw error;
  }
}; 