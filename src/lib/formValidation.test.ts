import { describe, it, expect } from 'vitest';
import {
  validateSaleSeller,
  validateExpensePaymentMethod,
  validateDeliverableTeamRole,
} from './formValidation';

describe('validateSaleSeller', () => {
  it('rejects empty / null / undefined / whitespace', () => {
    expect(validateSaleSeller(null)).not.toBeNull();
    expect(validateSaleSeller(undefined)).not.toBeNull();
    expect(validateSaleSeller('')).not.toBeNull();
    expect(validateSaleSeller('   ')).not.toBeNull();
  });
  it('accepts a profile id', () => {
    expect(validateSaleSeller('abc-123')).toBeNull();
  });
});

describe('validateExpensePaymentMethod', () => {
  it('rejects empty / null / whitespace', () => {
    expect(validateExpensePaymentMethod(null)).not.toBeNull();
    expect(validateExpensePaymentMethod('')).not.toBeNull();
    expect(validateExpensePaymentMethod('  ')).not.toBeNull();
  });
  it('accepts a method value', () => {
    expect(validateExpensePaymentMethod('iban:Conta Principal')).toBeNull();
    expect(validateExpensePaymentMethod('transferencia')).toBeNull();
  });
});

describe('validateDeliverableTeamRole', () => {
  it('ignores entregas do cliente / ambos', () => {
    expect(validateDeliverableTeamRole('cliente', null, null)).toBeNull();
    expect(validateDeliverableTeamRole('ambos', null, null)).toBeNull();
  });
  it('rejects equipa sem role nem assigned_to', () => {
    expect(validateDeliverableTeamRole('equipa', null, null)).not.toBeNull();
    expect(validateDeliverableTeamRole('equipa', '', '')).not.toBeNull();
    expect(validateDeliverableTeamRole('equipa', '   ', null)).not.toBeNull();
  });
  it('aceita quando há role definido', () => {
    expect(validateDeliverableTeamRole('equipa', 'Designer', null)).toBeNull();
  });
  it('aceita quando há membro atribuído (assigned_to)', () => {
    expect(validateDeliverableTeamRole('equipa', null, 'member-uuid')).toBeNull();
  });
});