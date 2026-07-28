import { ApiError } from './ApiError';
import { DraftErrorCode } from './DraftErrorCode';

export class DraftApiError extends ApiError {
  public readonly code: DraftErrorCode;

  constructor(message: string, code: DraftErrorCode, statusCode: number = 400, errors?: any[]) {
    super(message, statusCode, errors);
    this.name = 'DraftApiError';
    this.code = code;
    Object.setPrototypeOf(this, DraftApiError.prototype);
  }
}
