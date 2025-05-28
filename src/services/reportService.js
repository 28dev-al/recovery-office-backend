/**
 * Report Service
 * Handles generation and export of reports in various formats
 */
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const json2csv = require('json2csv').Parser;
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const analyticsService = require('./analyticsService');
const emailService = require('./emailService');
const logger = require('../utils/logger');
const { InternalError } = require('../utils/AppError');

/**
 * Generate a CSV report
 * 
 * @param {string} reportType - Type of report to generate
 * @param {Object} filters - Filters for the report data
 * @returns {Promise<Buffer>} CSV data as a buffer
 */
exports.generateCSV = async (reportType, filters = {}) => {
  try {
    const data = await getReportData(reportType, filters);
    
    if (!data || data.length === 0) {
      return Buffer.from('No data available for the selected criteria');
    }
    
    const json2csvParser = new json2csv({
      header: true,
      quote: '"'
    });
    
    const csv = json2csvParser.parse(data);
    return Buffer.from(csv);
  } catch (error) {
    logger.error(`Error generating CSV report: ${error.message}`, { error });
    throw new InternalError('Failed to generate CSV report');
  }
};

/**
 * Generate an Excel report
 * 
 * @param {string} reportType - Type of report to generate
 * @param {Object} filters - Filters for the report data
 * @returns {Promise<Buffer>} Excel data as a buffer
 */
exports.generateExcel = async (reportType, filters = {}) => {
  try {
    const data = await getReportData(reportType, filters);
    
    if (!data || data.length === 0) {
      throw new Error('No data available for the selected criteria');
    }
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    
    // Add title and filters
    const title = getReportTitle(reportType);
    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };
    
    // Add filter info
    const filterText = getFilterText(filters);
    worksheet.mergeCells('A2:E2');
    const filterCell = worksheet.getCell('A2');
    filterCell.value = filterText;
    filterCell.font = { size: 12, italic: true };
    filterCell.alignment = { horizontal: 'center' };
    
    // Add headers
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);
    
    // Style header row
    worksheet.getRow(3).font = { bold: true };
    worksheet.getRow(3).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Add data rows
    data.forEach(row => {
      const values = headers.map(header => row[header]);
      worksheet.addRow(values);
    });
    
    // Format columns
    headers.forEach((header, i) => {
      const column = worksheet.getColumn(i + 1);
      column.width = 20;
      column.alignment = { horizontal: 'left' };
    });
    
    // Generate buffer
    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    logger.error(`Error generating Excel report: ${error.message}`, { error });
    throw new InternalError('Failed to generate Excel report');
  }
};

/**
 * Generate a PDF report
 * 
 * @param {string} reportType - Type of report to generate
 * @param {Object} filters - Filters for the report data
 * @returns {Promise<Buffer>} PDF data as a buffer
 */
exports.generatePDF = async (reportType, filters = {}) => {
  try {
    const data = await getReportData(reportType, filters);
    
    if (!data || data.length === 0) {
      throw new Error('No data available for the selected criteria');
    }
    
    return new Promise((resolve, reject) => {
      try {
        const chunks = [];
        const doc = new PDFDocument({ margin: 50 });
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', err => reject(err));
        
        // Add title
        const title = getReportTitle(reportType);
        doc.fontSize(20).text(title, { align: 'center' });
        doc.moveDown();
        
        // Add filter info
        const filterText = getFilterText(filters);
        doc.fontSize(12).text(filterText, { align: 'center' });
        doc.moveDown(2);
        
        // Define table layout
        const headers = Object.keys(data[0]);
        const columnWidth = 500 / headers.length;
        
        // Draw headers
        doc.font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(formatHeader(header), 50 + (i * columnWidth), doc.y, {
            width: columnWidth,
            align: 'left'
          });
        });
        
        doc.moveDown();
        doc.font('Helvetica');
        
        // Draw rows
        let y = doc.y;
        data.forEach((row, rowIndex) => {
          // Check if we need a new page
          if (y > 700) {
            doc.addPage();
            y = 50;
            
            // Redraw headers on new page
            doc.font('Helvetica-Bold');
            headers.forEach((header, i) => {
              doc.text(formatHeader(header), 50 + (i * columnWidth), y, {
                width: columnWidth,
                align: 'left'
              });
            });
            
            doc.font('Helvetica');
            y = doc.y + 10;
          }
          
          // Draw row data
          headers.forEach((header, i) => {
            const cellValue = row[header] !== undefined ? row[header].toString() : '';
            doc.text(cellValue, 50 + (i * columnWidth), y, {
              width: columnWidth,
              align: 'left'
            });
          });
          
          y = doc.y + 10;
        });
        
        // Add footer with date
        const footerText = `Generated on ${moment().format('MMMM D, YYYY [at] h:mm A')}`;
        doc.text(footerText, 50, doc.page.height - 50, {
          align: 'center'
        });
        
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  } catch (error) {
    logger.error(`Error generating PDF report: ${error.message}`, { error });
    throw new InternalError('Failed to generate PDF report');
  }
};

/**
 * Schedule a report to be sent via email
 * 
 * @param {string} reportType - Type of report to generate
 * @param {Object} filters - Filters for the report data
 * @param {string} email - Email address to send the report to
 * @param {string} format - Format of the report (csv, excel, pdf)
 * @param {string} frequency - How often to send the report (once, daily, weekly, monthly)
 * @returns {Promise<Object>} Result of scheduling the report
 */
exports.scheduleReport = async (reportType, filters, email, format, frequency) => {
  try {
    // For simplicity, we'll just generate and send the report once
    // In a real implementation, you would store the schedule in the database
    // and use a job scheduler like node-cron to send reports on schedule
    
    let reportBuffer;
    let mimeType;
    let extension;
    
    switch (format) {
      case 'csv':
        reportBuffer = await exports.generateCSV(reportType, filters);
        mimeType = 'text/csv';
        extension = 'csv';
        break;
      case 'excel':
        reportBuffer = await exports.generateExcel(reportType, filters);
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extension = 'xlsx';
        break;
      case 'pdf':
      default:
        reportBuffer = await exports.generatePDF(reportType, filters);
        mimeType = 'application/pdf';
        extension = 'pdf';
    }
    
    const title = getReportTitle(reportType);
    const fileName = `${reportType}_report_${moment().format('YYYY-MM-DD')}.${extension}`;
    
    await emailService.sendEmail({
      to: email,
      subject: `${title} - Recovery Office Report`,
      html: `
        <h2>Recovery Office Report</h2>
        <p>Please find attached your requested ${title}.</p>
        <p>This report was generated on ${moment().format('MMMM D, YYYY [at] h:mm A')}.</p>
        <p>Thank you for using our services.</p>
      `,
      attachments: [
        {
          filename: fileName,
          content: reportBuffer,
          contentType: mimeType
        }
      ]
    });
    
    return {
      message: `Report has been sent to ${email}`,
      reportType,
      format,
      sentAt: new Date()
    };
  } catch (error) {
    logger.error(`Error scheduling report: ${error.message}`, { error });
    throw new InternalError('Failed to schedule report');
  }
};

/**
 * Get data for a specific report type
 * 
 * @param {string} reportType - Type of report to generate
 * @param {Object} filters - Filters for the report data
 * @returns {Promise<Array>} Report data
 */
async function getReportData(reportType, filters) {
  const { startDate, endDate, period, limit } = filters;
  
  switch (reportType) {
    case 'booking-stats':
      const bookingStats = await analyticsService.getBookingStats(startDate, endDate);
      return transformBookingStatsForReport(bookingStats);
      
    case 'service-popularity':
      return await analyticsService.getServicePopularity(startDate, endDate, limit);
      
    case 'client-acquisition':
      return await analyticsService.getClientAcquisition(period, limit);
      
    case 'waitlist-metrics':
      const waitlistMetrics = await analyticsService.getWaitlistMetrics(startDate, endDate);
      return transformWaitlistMetricsForReport(waitlistMetrics);
      
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}

/**
 * Transform booking stats into a format suitable for reports
 * 
 * @param {Object} stats - Booking statistics
 * @returns {Array} Transformed data
 */
function transformBookingStatsForReport(stats) {
  const { statusCounts, dailyBookings } = stats;
  
  // Transform daily bookings into report format
  const reportData = dailyBookings.map(day => ({
    Date: day._id,
    Bookings: day.count
  }));
  
  // Add summary rows
  const summary = [
    {
      Date: 'TOTAL CONFIRMED',
      Bookings: statusCounts.confirmed || 0
    },
    {
      Date: 'TOTAL COMPLETED',
      Bookings: statusCounts.completed || 0
    },
    {
      Date: 'TOTAL CANCELLED',
      Bookings: statusCounts.cancelled || 0
    },
    {
      Date: 'TOTAL PENDING',
      Bookings: statusCounts.pending || 0
    }
  ];
  
  return [...reportData, ...summary];
}

/**
 * Transform waitlist metrics into a format suitable for reports
 * 
 * @param {Object} metrics - Waitlist metrics
 * @returns {Array} Transformed data
 */
function transformWaitlistMetricsForReport(metrics) {
  const { statusCounts, topServices, conversionRate } = metrics;
  
  // Create service rows
  const serviceRows = topServices.map(service => ({
    Category: 'Service',
    Name: service.serviceName,
    Count: service.count,
    'Conversion Rate': `${conversionRate}%`,
    Status: 'N/A'
  }));
  
  // Add status summary rows
  const statusRows = Object.entries(statusCounts).map(([status, count]) => ({
    Category: 'Status',
    Name: status.charAt(0).toUpperCase() + status.slice(1),
    Count: count,
    'Conversion Rate': status === 'booked' ? `100%` : '0%',
    Status: status
  }));
  
  return [...serviceRows, ...statusRows];
}

/**
 * Get the title for a report
 * 
 * @param {string} reportType - Type of report
 * @returns {string} Report title
 */
function getReportTitle(reportType) {
  switch (reportType) {
    case 'booking-stats':
      return 'Booking Statistics Report';
    case 'service-popularity':
      return 'Service Popularity Report';
    case 'client-acquisition':
      return 'Client Acquisition Report';
    case 'waitlist-metrics':
      return 'Waitlist Metrics Report';
    default:
      return 'Recovery Office Report';
  }
}

/**
 * Generate filter description text
 * 
 * @param {Object} filters - Report filters
 * @returns {string} Formatted filter text
 */
function getFilterText(filters) {
  const { startDate, endDate, period } = filters;
  
  if (startDate && endDate) {
    return `Period: ${moment(startDate).format('MMM D, YYYY')} to ${moment(endDate).format('MMM D, YYYY')}`;
  } else if (period) {
    return `Period: ${period.charAt(0).toUpperCase() + period.slice(1)}`;
  } else {
    return `Period: Last 30 days`;
  }
}

/**
 * Format header text for display
 * 
 * @param {string} header - Header key
 * @returns {string} Formatted header text
 */
function formatHeader(header) {
  // Convert camelCase to Title Case with Spaces
  return header
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
} 