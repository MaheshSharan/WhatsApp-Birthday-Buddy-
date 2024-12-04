// Validate date format (dd/mm/yyyy)
function validateDate(date) {
    if (!date) return false;

    // Check format
    const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
    if (!dateRegex.test(date)) return false;

    // Check valid date
    const [day, month, year] = date.split('/').map(Number);
    const dateObj = new Date(year, month - 1, day);
    
    return dateObj.getDate() === day &&
           dateObj.getMonth() === month - 1 &&
           dateObj.getFullYear() === year;
}

// Validate phone number (supports international format)
function validatePhoneNumber(phoneNumber) {
    if (!phoneNumber) return false;

    // Remove spaces and dashes
    const cleanNumber = phoneNumber.replace(/[\s-]/g, '');

    // Basic international format: +CountryCode followed by 6-15 digits
    const phoneRegex = /^\+?([0-9]{1,4})?[0-9]{6,15}$/;
    return phoneRegex.test(cleanNumber);
}

// Validate name
function validateName(name) {
    if (!name || typeof name !== 'string') return false;
    
    // Name should be 2-50 characters, allowing letters, spaces, and common name characters
    const nameRegex = /^[A-Za-z\s'-]{2,50}$/;
    return nameRegex.test(name.trim());
}

// Format phone number to standard format
function formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters except '+'
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // If number doesn't start with '+', assume it's a local number and add country code
    if (!cleaned.startsWith('+')) {
        return `+${cleaned}`;
    }
    
    return cleaned;
}

// Format date to standard format (dd/mm/yyyy)
function formatDate(date) {
    const [day, month, year] = date.split('/');
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}

module.exports = {
    validateDate,
    validatePhoneNumber,
    validateName,
    formatPhoneNumber,
    formatDate
};
