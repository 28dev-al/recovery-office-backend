const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Email service for sending notifications
 */
class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.example.com',
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || 'user@example.com',
        pass: process.env.EMAIL_PASS || 'password'
      }
    });

    this.from = process.env.EMAIL_FROM || 'Recovery Office <bookings@recovery-office.com>';
  }

  /**
   * Send booking confirmation email
   * 
   * @param {Object} booking - Booking details
   * @param {Object} client - Client details
   * @param {Object} service - Service details
   * @returns {Promise} Email sending result
   */
  async sendBookingConfirmation(booking, client, service) {
    try {
      const bookingDate = new Date(booking.date).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const mailOptions = {
        from: this.from,
        to: client.email,
        subject: `Booking Confirmation - ${booking.referenceNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee;">
            <div style="background-color: #003366; color: white; padding: 15px; text-align: center;">
              <h1 style="margin: 0;">Recovery Office</h1>
            </div>
            
            <div style="padding: 20px;">
              <h2>Booking Confirmation</h2>
              <p>Dear ${client.firstName},</p>
              <p>Thank you for booking with Recovery Office. Your booking has been confirmed.</p>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Reference Number:</strong> ${booking.referenceNumber}</p>
                <p><strong>Service:</strong> ${service.name}</p>
                <p><strong>Date:</strong> ${bookingDate}</p>
                <p><strong>Time:</strong> ${booking.timeSlot}</p>
              </div>
              
              <p>If you need to make any changes to your booking, please contact us as soon as possible or visit our website.</p>
              <p>We look forward to assisting you with your financial recovery needs.</p>
              
              <p>Best regards,<br>Recovery Office Team</p>
            </div>
            
            <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
              <p>Recovery Office Ltd, Financial Recovery Specialists</p>
              <p>© ${new Date().getFullYear()} Recovery Office. All rights reserved.</p>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      // Log email sending for tracking
      console.log(`Booking confirmation email sent to ${client.email} for booking ${booking.referenceNumber}`);
      
      return {
        success: true,
        messageId: result.messageId
      };
    } catch (err) {
      console.error('Email sending failed:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Send booking notification to staff
   * 
   * @param {Object} booking - Booking details
   * @param {Object} client - Client details
   * @param {Object} service - Service details
   * @returns {Promise} Email sending result
   */
  async sendStaffNotification(booking, client, service) {
    try {
      const bookingDate = new Date(booking.date).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const mailOptions = {
        from: this.from,
        to: process.env.STAFF_EMAIL || 'staff@recovery-office.com',
        subject: `New Booking - ${booking.referenceNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee;">
            <div style="background-color: #003366; color: white; padding: 15px; text-align: center;">
              <h1 style="margin: 0;">Recovery Office</h1>
            </div>
            
            <div style="padding: 20px;">
              <h2>New Booking Notification</h2>
              <p>A new booking has been made:</p>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Reference Number:</strong> ${booking.referenceNumber}</p>
                <p><strong>Service:</strong> ${service.name}</p>
                <p><strong>Date:</strong> ${bookingDate}</p>
                <p><strong>Time:</strong> ${booking.timeSlot}</p>
                <p><strong>Client:</strong> ${client.firstName} ${client.lastName}</p>
                <p><strong>Email:</strong> ${client.email}</p>
                <p><strong>Phone:</strong> ${client.phone}</p>
                ${booking.notes ? `<p><strong>Notes:</strong> ${booking.notes}</p>` : ''}
              </div>
              
              <p>Please log in to the admin dashboard to view and manage this booking.</p>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      // Log email sending for tracking
      console.log(`Staff notification email sent for booking ${booking.referenceNumber}`);
      
      return {
        success: true,
        messageId: result.messageId
      };
    } catch (err) {
      console.error('Staff notification email sending failed:', err);
      return {
        success: false,
        error: err.message
      };
    }
  }
}

module.exports = new EmailService(); 