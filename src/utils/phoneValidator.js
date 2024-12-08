class PhoneValidator {
    static isValidWhatsAppNumber(number) {
        // Remove any WhatsApp suffix
        const cleanNumber = number.split('@')[0];
        
        // Basic validation rules
        const rules = [
            // Must be numbers only (except for + prefix)
            /^[+]?\d+$/,
            // Length between 10 and 15 digits (including country code)
            /.{10,15}/,
            // Should not start with multiple zeros
            /^(?!00+)/,
            // Should not be all same digits
            /^(?!(\d)\1+$)/
        ];

        // Check all rules
        return rules.every(rule => rule.test(cleanNumber));
    }

    static normalizeNumber(number) {
        // Remove any WhatsApp suffix and spaces
        let normalized = number.split('@')[0].replace(/\s+/g, '');
        
        // Ensure it starts with '+'
        if (!normalized.startsWith('+')) {
            normalized = '+' + normalized;
        }
        
        return normalized;
    }

    static isSuspiciousNumber(number) {
        const cleanNumber = number.split('@')[0];
        
        // Suspicious patterns
        const suspiciousPatterns = [
            // Repeating digits (more than 4 times)
            /(\d)\1{4,}/,
            // Sequential digits (more than 5 in sequence)
            /(01234|12345|23456|34567|45678|56789|98765|87654|76543|65432|54321|43210)/,
            // Too many zeros
            /0{5,}/,
            // Extremely long numbers
            /^\d{16,}/
        ];

        return suspiciousPatterns.some(pattern => pattern.test(cleanNumber));
    }
}

module.exports = PhoneValidator;
