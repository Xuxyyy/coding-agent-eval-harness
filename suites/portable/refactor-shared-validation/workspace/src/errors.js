export class ValidationError extends Error {
  constructor(messages) {
    super(messages.join('; '));
    this.name = 'ValidationError';
    this.messages = messages;
  }
}
