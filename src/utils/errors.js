class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

class CommandError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CommandError';
    }
}

class AIError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AIError';
    }
}

module.exports = {
    ValidationError,
    CommandError,
    AIError
};
