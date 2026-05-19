import { describe, it, expect } from 'vitest';
import { detectGrowthTaskType } from './useGrowthOnboarding';

describe('detectGrowthTaskType', () => {
  // ── V1 descriptions ──
  it('recognizes v1 growth:welcome', () => {
    expect(detectGrowthTaskType({ description: 'growth:welcome', title: '' })).toBe('welcome');
  });

  it('recognizes v1 growth:schedule_call', () => {
    expect(detectGrowthTaskType({ description: 'growth:schedule_call', title: '' })).toBe('schedule_call');
  });

  it('recognizes v1 growth:do_call', () => {
    expect(detectGrowthTaskType({ description: 'growth:do_call', title: '' })).toBe('do_call');
  });

  it('recognizes v1 growth:align_project', () => {
    expect(detectGrowthTaskType({ description: 'growth:align_project', title: '' })).toBe('align_project');
  });

  // ── V1 title fallback ──
  it('falls back to title prefix for welcome', () => {
    expect(detectGrowthTaskType({ description: null, title: 'Dar boas-vindas para Cliente X' })).toBe('welcome');
  });

  it('falls back to title prefix for schedule_call', () => {
    expect(detectGrowthTaskType({ description: null, title: 'Marcar Call #1 Cliente X' })).toBe('schedule_call');
  });

  // ── V2 descriptions ──
  it('recognizes v2 growth:marcar_call_1', () => {
    const result = detectGrowthTaskType({ description: 'growth:marcar_call_1', title: '' });
    expect(result).not.toBeNull();
    expect(result).toBe('marcar_call_1');
  });

  it('recognizes v2 growth:realizar_call_1', () => {
    const result = detectGrowthTaskType({ description: 'growth:realizar_call_1', title: '' });
    expect(result).not.toBeNull();
    expect(result).toBe('realizar_call_1');
  });

  it('recognizes v2 growth:escolher_equipe', () => {
    const result = detectGrowthTaskType({ description: 'growth:escolher_equipe', title: '' });
    expect(result).not.toBeNull();
    expect(result).toBe('escolher_equipe');
  });

  it('recognizes v2 growth:alinhar_projeto', () => {
    const result = detectGrowthTaskType({ description: 'growth:alinhar_projeto', title: '' });
    expect(result).not.toBeNull();
    expect(result).toBe('alinhar_projeto');
  });

  it('recognizes v2 growth:brifar_crm', () => {
    const result = detectGrowthTaskType({ description: 'growth:brifar_crm', title: '' });
    expect(result).not.toBeNull();
    expect(result).toBe('brifar_crm');
  });

  it('recognizes v2 growth:brifar_crm_alinhar', () => {
    const result = detectGrowthTaskType({ description: 'growth:brifar_crm_alinhar', title: '' });
    expect(result).not.toBeNull();
    expect(result).toBe('brifar_crm_alinhar');
  });

  // ── Unknown ──
  it('returns null for unknown description', () => {
    expect(detectGrowthTaskType({ description: 'growth:unknown_step', title: '' })).toBeNull();
  });

  it('returns null for non-growth task', () => {
    expect(detectGrowthTaskType({ description: 'some random task', title: 'Random Task' })).toBeNull();
  });

  it('returns null for empty task', () => {
    expect(detectGrowthTaskType({ description: null, title: '' })).toBeNull();
  });
});
