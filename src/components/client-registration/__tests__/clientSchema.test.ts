import { describe, it, expect } from 'vitest';
import { clientSchema } from '../ClientRegistrationForm';

/**
 * Validates Zod schema refinements for Growth conditional form logic.
 * Growth path: ads_manager/comercial/crm/mktplace NOT required at registration.
 * Only group_id, squad_id, assigned_sucesso_cliente are required.
 */

function baseValid() {
  return {
    name: 'Acme Corp',
    cnpj: '11.222.333/0001-81',
    razao_social: 'Acme Corporation LTDA',
    niche: 'Tecnologia',
    general_info: 'Info about client',
    expected_investment: '10.000,00',
    sales_percentage: 10,
    entry_date: '2026-01-15',
    contract_duration_months: 12,
    payment_due_day: 10,
    contracted_products: [] as string[],
    product_values: {} as Record<string, string>,
    torque_crm_products: [] as ('torque' | 'automation' | 'copilot')[],
    group_id: '',
    squad_id: '',
    assigned_ads_manager: '',
    assigned_comercial: '',
    assigned_crm: '',
    assigned_rh: '',
    assigned_outbound_manager: '',
    assigned_mktplace: '',
    assigned_sucesso_cliente: '',
    has_mktplace_consulting: null as 'sim' | 'nao' | null,
  };
}

describe('clientSchema — Growth conditional fields', () => {
  it('Growth-only: passes without ads/comercial/crm/mktplace', () => {
    const data = {
      ...baseValid(),
      contracted_products: ['millennials-growth'],
      product_values: { 'millennials-growth': '5.000,00' },
      group_id: 'g1',
      squad_id: 's1',
      assigned_sucesso_cliente: 'user-cs-1',
    };
    const result = clientSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('Growth-only: passes without assigned_sucesso_cliente (CX auto-derived)', () => {
    const data = {
      ...baseValid(),
      contracted_products: ['millennials-growth'],
      product_values: { 'millennials-growth': '5.000,00' },
      group_id: 'g1',
      squad_id: 's1',
      assigned_sucesso_cliente: '',
    };
    const result = clientSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('Growth-only: fails without group_id', () => {
    const data = {
      ...baseValid(),
      contracted_products: ['millennials-growth'],
      product_values: { 'millennials-growth': '5.000,00' },
      group_id: '',
      squad_id: 's1',
      assigned_sucesso_cliente: 'user-cs-1',
    };
    const result = clientSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('Growth-only: fails without squad_id', () => {
    const data = {
      ...baseValid(),
      contracted_products: ['millennials-growth'],
      product_values: { 'millennials-growth': '5.000,00' },
      group_id: 'g1',
      squad_id: '',
      assigned_sucesso_cliente: 'user-cs-1',
    };
    const result = clientSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('Growth-only: does NOT require ads_manager', () => {
    const data = {
      ...baseValid(),
      contracted_products: ['millennials-growth'],
      product_values: { 'millennials-growth': '5.000,00' },
      group_id: 'g1',
      squad_id: 's1',
      assigned_sucesso_cliente: 'user-cs-1',
      assigned_ads_manager: '',
    };
    const result = clientSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('Growth-only: does NOT require mktplace consulting question', () => {
    const data = {
      ...baseValid(),
      contracted_products: ['millennials-growth'],
      product_values: { 'millennials-growth': '5.000,00' },
      group_id: 'g1',
      squad_id: 's1',
      assigned_sucesso_cliente: 'user-cs-1',
      has_mktplace_consulting: null,
    };
    const result = clientSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('Growth + gestor-mktplace: requires mktplace consulting question', () => {
    const data = {
      ...baseValid(),
      contracted_products: ['millennials-growth', 'gestor-mktplace'],
      product_values: {
        'millennials-growth': '5.000,00',
        'gestor-mktplace': '3.000,00',
      },
      group_id: 'g1',
      squad_id: 's1',
      assigned_sucesso_cliente: 'user-cs-1',
      has_mktplace_consulting: null,
    };
    const result = clientSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path.join('.'));
      expect(paths).toContain('has_mktplace_consulting');
    }
  });

  it('Growth + gestor-mktplace + consulting sim: requires mktplace consultant', () => {
    const data = {
      ...baseValid(),
      contracted_products: ['millennials-growth', 'gestor-mktplace'],
      product_values: {
        'millennials-growth': '5.000,00',
        'gestor-mktplace': '3.000,00',
      },
      group_id: 'g1',
      squad_id: 's1',
      assigned_sucesso_cliente: 'user-cs-1',
      has_mktplace_consulting: 'sim' as const,
      assigned_mktplace: '',
    };
    const result = clientSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path.join('.'));
      expect(paths).toContain('assigned_mktplace');
    }
  });

  it('Torque CRM: still requires crm manager', () => {
    const data = {
      ...baseValid(),
      contracted_products: ['torque-crm'],
      product_values: { 'torque-crm': '2.000,00' },
      torque_crm_products: ['torque'] as ('torque' | 'automation' | 'copilot')[],
      assigned_crm: '',
    };
    const result = clientSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path.join('.'));
      expect(paths).toContain('assigned_crm');
    }
  });

  it('Growth-only: does NOT require comercial/crm/mktplace', () => {
    const data = {
      ...baseValid(),
      contracted_products: ['millennials-growth'],
      product_values: { 'millennials-growth': '5.000,00' },
      group_id: 'g1',
      squad_id: 's1',
      assigned_comercial: '',
      assigned_crm: '',
      assigned_mktplace: '',
    };
    const result = clientSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('Growth-only: requires group_id', () => {
    const data = {
      ...baseValid(),
      contracted_products: ['millennials-growth'],
      product_values: { 'millennials-growth': '5.000,00' },
      group_id: '',
      squad_id: 's1',
    };
    const result = clientSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('Growth-only: requires squad_id', () => {
    const data = {
      ...baseValid(),
      contracted_products: ['millennials-growth'],
      product_values: { 'millennials-growth': '5.000,00' },
      group_id: 'g1',
      squad_id: '',
    };
    const result = clientSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('No products: passes without any team fields', () => {
    const data = baseValid();
    const result = clientSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});
