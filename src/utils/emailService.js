const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.protonmail.ch',
      port: 587,
      secure: false, // STARTTLS
      auth: {
        user: 'contact@recovery-office.com',
        pass: 'CMG8Z2FD1VDHWR79'
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    this.verifyConnection();
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ [Email Service] Connected successfully to ProtonMail SMTP');
    } catch (error) {
      console.error('❌ [Email Service] Connection failed:', error);
    }
  }

  async sendNewBookingConfirmation(clientData, bookingData) {
    try {
      console.log(`[Email Service] Sending confirmation to: ${clientData.email}`);

      const mailOptions = {
        from: {
          name: 'Recovery Office',
          address: 'contact@recovery-office.com'
        },
        to: clientData.email,
        subject: `Booking Confirmation - Recovery Office (Ref: ${bookingData.reference})`,
        html: this.generateClientEmail(clientData, bookingData),
        text: this.generateClientTextEmail(clientData, bookingData)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ [Email Service] Client confirmation sent:', result.messageId);
      return { success: true, messageId: result.messageId };
      
    } catch (error) {
      console.error('❌ [Email Service] Client email failed:', error);
      return { success: false, error: error.message };
    }
  }

  async sendNewInternalNotification(clientData, bookingData) {
    try {
      console.log('[Email Service] Sending internal notification...');

      const mailOptions = {
        from: {
          name: 'Recovery Office System',
          address: 'contact@recovery-office.com'
        },
        to: 'contact@recovery-office.com',
        subject: `🔔 New Booking: ${clientData.firstName} ${clientData.lastName} - ${bookingData.serviceName}`,
        html: this.generateInternalEmail(clientData, bookingData),
        text: this.generateInternalTextEmail(clientData, bookingData)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ [Email Service] Internal notification sent:', result.messageId);
      return { success: true, messageId: result.messageId };
      
    } catch (error) {
      console.error('❌ [Email Service] Internal email failed:', error);
      return { success: false, error: error.message };
    }
  }

  generateClientEmail(clientData, bookingData) {
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); color: white; padding: 30px 20px; text-align: center; }
        .logo { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
        .content { padding: 30px 20px; }
        .confirmation { background: #f0fff4; border: 2px solid #38a169; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
        .details { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .label { font-weight: bold; color: #1a365d; }
        .footer { background: #2d3748; color: #a0aec0; padding: 20px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">RECOVERY OFFICE</div>
            <div>Professional Financial Recovery Services</div>
        </div>
        
        <div class="content">
            <h2 style="color: #1a365d;">Dear ${clientData.firstName} ${clientData.lastName},</h2>
            
            <p>Thank you for booking a consultation with Recovery Office. Your booking has been confirmed and we look forward to assisting you with your financial recovery needs.</p>
            
            <div class="confirmation">
                <h3 style="color: #38a169; margin-top: 0;">✅ Booking Confirmed</h3>
                <p>Reference: <strong>${bookingData.reference}</strong></p>
            </div>
            
            <div class="details">
                <h3 style="color: #1a365d; margin-top: 0;">Consultation Details</h3>
                
                <div class="detail-row">
                    <span class="label">Service:</span>
                    <span>${bookingData.serviceName}</span>
                </div>
                
                <div class="detail-row">
                    <span class="label">Date:</span>
                    <span>${formatDate(bookingData.date)}</span>
                </div>
                
                <div class="detail-row">
                    <span class="label">Time:</span>
                    <span>${bookingData.timeSlot === 'Time not available' ? 'To be confirmed' : bookingData.timeSlot}</span>
                </div>
                
                <div class="detail-row">
                    <span class="label">Specialist:</span>
                    <span>Alex Bianchi - Senior Recovery Specialist</span>
                </div>
                
                <div class="detail-row">
                    <span class="label">Contact:</span>
                    <span>+44 7451 263472</span>
                </div>
            </div>
            
            <h3 style="color: #1a365d;">What happens next?</h3>
            <ul>
                <li><strong>Confirmation call:</strong> We will contact you within 24 hours to confirm details</li>
                <li><strong>Preparation:</strong> Please gather relevant documentation</li>
                <li><strong>Consultation:</strong> Comprehensive assessment of your situation</li>
                <li><strong>Action plan:</strong> Detailed recovery strategy and next steps</li>
            </ul>
            
            <div style="background: #fff5f5; border: 1px solid #feb2b2; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #c53030;"><strong>Important:</strong> This consultation is completely confidential with no obligation to proceed.</p>
            </div>
            
            <p>For questions or to reschedule, contact us at <a href="mailto:contact@recovery-office.com">contact@recovery-office.com</a> or +44 7451 263472.</p>
            
            <p>Best regards,<br><strong>The Recovery Office Team</strong></p>
        </div>
        
        <div class="footer">
            <p><strong>Recovery Office Limited</strong><br>
            Professional Financial Recovery Consultancy<br>
            London, United Kingdom<br>
            FCA Authorised - Reference: 836358</p>
            
            <p>This email is confidential. If you are not the intended recipient, please delete and notify us immediately.</p>
        </div>
    </div>
</body>
</html>
`;
  }

  generateInternalEmail(clientData, bookingData) {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #d69e2e 0%, #f6ad3a 100%); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .client-info { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 15px 0; }
        .booking-info { background: #f0fff4; border-radius: 8px; padding: 20px; margin: 15px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .label { font-weight: bold; color: #1a365d; }
        .priority { background: #fff5f5; border: 1px solid #feb2b2; border-radius: 8px; padding: 15px; margin: 15px 0; color: #c53030; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0;">🔔 New Booking Alert</h1>
            <p style="margin: 5px 0 0 0;">Recovery Office Dashboard</p>
        </div>
        
        <div class="content">
            <h2 style="color: #1a365d;">New Consultation Booking</h2>
            
            <div class="priority">
                <strong>Action Required: Contact client within 24 hours</strong>
            </div>
            
            <div class="client-info">
                <h3 style="color: #1a365d; margin-top: 0;">Client Information</h3>
                
                <div class="detail-row">
                    <span class="label">Name:</span>
                    <span>${clientData.firstName} ${clientData.lastName}</span>
                </div>
                
                <div class="detail-row">
                    <span class="label">Email:</span>
                    <span><a href="mailto:${clientData.email}">${clientData.email}</a></span>
                </div>
                
                <div class="detail-row">
                    <span class="label">Phone:</span>
                    <span><a href="tel:${clientData.phone}">${clientData.phone}</a></span>
                </div>
                
                <div class="detail-row">
                    <span class="label">Preferred Contact:</span>
                    <span>${clientData.preferredContactMethod || 'Not specified'}</span>
                </div>
                
                <div class="detail-row">
                    <span class="label">Estimated Loss:</span>
                    <span>£${(clientData.estimatedLoss || 0).toLocaleString()}</span>
                </div>
            </div>
            
            <div class="booking-info">
                <h3 style="color: #1a365d; margin-top: 0;">Booking Details</h3>
                
                <div class="detail-row">
                    <span class="label">Reference:</span>
                    <span><strong>${bookingData.reference}</strong></span>
                </div>
                
                <div class="detail-row">
                    <span class="label">Service:</span>
                    <span>${bookingData.serviceName}</span>
                </div>
                
                <div class="detail-row">
                    <span class="label">Date:</span>
                    <span>${new Date(bookingData.date).toLocaleDateString('en-GB')}</span>
                </div>
                
                <div class="detail-row">
                    <span class="label">Time:</span>
                    <span>${bookingData.timeSlot}</span>
                </div>
                
                <div class="detail-row">
                    <span class="label">Urgency:</span>
                    <span>${bookingData.urgencyLevel || 'Standard'}</span>
                </div>
            </div>
            
            ${clientData.notes ? `
            <div style="background: #f7fafc; border-radius: 8px; padding: 15px; margin: 15px 0;">
                <h4 style="color: #1a365d; margin-top: 0;">Notes:</h4>
                <p style="margin: 0;">${clientData.notes}</p>
            </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 30px;">
                <a href="https://recovery-office.com/dashboard/bookings" 
                   style="background: linear-gradient(135deg, #d69e2e 0%, #f6ad3a 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    View in Dashboard
                </a>
            </div>
        </div>
    </div>
</body>
</html>
`;
  }

  generateClientTextEmail(clientData, bookingData) {
    return `
RECOVERY OFFICE - BOOKING CONFIRMATION

Dear ${clientData.firstName} ${clientData.lastName},

Your consultation booking has been confirmed.

BOOKING DETAILS:
Reference: ${bookingData.reference}
Service: ${bookingData.serviceName}
Date: ${new Date(bookingData.date).toLocaleDateString('en-GB')}
Time: ${bookingData.timeSlot}
Specialist: Alex Bianchi

We will contact you within 24 hours to confirm details.

Contact: +44 7451 263472 | contact@recovery-office.com

Best regards,
Recovery Office Team
FCA Authorised Reference: 836358
`;
  }

  generateInternalTextEmail(clientData, bookingData) {
    return `
NEW BOOKING - RECOVERY OFFICE

Client: ${clientData.firstName} ${clientData.lastName}
Email: ${clientData.email}
Phone: ${clientData.phone}
Service: ${bookingData.serviceName}
Date: ${new Date(bookingData.date).toLocaleDateString('en-GB')}
Reference: ${bookingData.reference}

ACTION REQUIRED: Contact within 24 hours
`;
  }

  // Legacy compatibility methods to match existing booking controller calls
  async sendBookingConfirmation(email, firstName, data) {
    const clientData = {
      firstName,
      lastName: '',
      email,
      phone: '',
      preferredContactMethod: '',
      estimatedLoss: 0,
      notes: ''
    };

    const bookingData = {
      reference: data.reference,
      serviceName: data.serviceName,
      date: data.date,
      timeSlot: data.timeSlot,
      urgencyLevel: 'standard'
    };

    return await this.sendNewBookingConfirmation(clientData, bookingData);
  }

  async sendAdminNotification(title, data) {
    const clientData = {
      firstName: data.clientName?.split(' ')[0] || '',
      lastName: data.clientName?.split(' ').slice(1).join(' ') || '',
      email: data.clientEmail,
      phone: data.clientPhone || '',
      preferredContactMethod: '',
      estimatedLoss: data.estimatedValue || 0,
      notes: ''
    };

    const bookingData = {
      reference: data.reference,
      serviceName: data.serviceName,
      date: data.date,
      timeSlot: data.timeSlot,
      urgencyLevel: data.urgencyLevel || 'standard'
    };

    return await this.sendNewInternalNotification(clientData, bookingData);
  }
}

module.exports = new EmailService(); 