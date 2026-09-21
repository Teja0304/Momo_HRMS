import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Enforces: at least 8 characters, one uppercase letter, one lowercase
 * letter, and one symbol. Used on every field that sets a password
 * (new user creation, admin reset, change-password, set-initial-password)
 * so a weak password can never reach the database regardless of which
 * endpoint is used to set it.
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: {
        message:
          'password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a symbol',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          const hasUpper = /[A-Z]/.test(value);
          const hasLower = /[a-z]/.test(value);
          const hasSymbol = /[^A-Za-z0-9]/.test(value);
          return value.length >= 8 && hasUpper && hasLower && hasSymbol;
        },
      },
    });
  };
}