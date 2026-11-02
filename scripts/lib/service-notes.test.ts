import type { ServiceNote } from '../../src/data/types';
import { validate, type ValidationInput, type ValidationRules } from './validate';

const rules: ValidationRules = { total: 0, setCount: 0, setSize: 65, quota: { 1: 0, 2: 0, 3: 0, 4: 0 } };

function note(over: Partial<ServiceNote> = {}): ServiceNote {
  return {
    id: 's3',
    name: 'Amazon S3',
    category: 'Storage',
    tier: 'core',
    overview: 'Object storage.',
    concepts: [{ term: 'Bucket', desc: 'A container for objects.' }],
    howItWorks: 'Objects are stored in buckets.',
    useCases: ['Store application files.'],
    pricing: 'Charges can include storage, requests, retrieval, and transfer.',
    examSignals: ['Object storage with key-based access.'],
    compareWith: [{ service: 'Amazon EFS', diff: 'Object storage versus shared file storage.' }],
    facts: ['Versioning preserves object versions.'],
    practice: {
      steps: ['Create a private test bucket.', 'Upload a test object.'],
      freeTier: 'Check account eligibility and current regional pricing before creating resources.',
      cleanup: ['Delete all objects, then delete the bucket.'],
    },
    ...over,
  };
}

function input(serviceNote: ServiceNote): ValidationInput {
  return {
    questions: [],
    metas: [],
    vis: [],
    registry: [{ id: 's3', name: 'Amazon S3', category: 'Storage' }],
    noteIds: ['s3'],
    serviceNotes: [serviceNote],
    sets: null,
  };
}

describe('service note validation', () => {
  it('accepts a complete core note', () => {
    const report = validate(input(note()), rules);
    expect(report.errors.filter((e) => e.startsWith('services:'))).toEqual([]);
  });

  it('requires a practice and cleanup for core notes', () => {
    const report = validate(input(note({ practice: undefined })), rules);
    expect(report.errors).toContain('services: core "s3" thiếu practice.steps');
    expect(report.errors).toContain('services: core "s3" thiếu practice.cleanup');
  });

  it('requires overview, exam signals, and comparisons for minor notes', () => {
    const minor = note({ tier: 'minor', concepts: undefined, howItWorks: undefined, useCases: undefined, pricing: undefined, facts: undefined, practice: undefined });
    expect(validate(input(minor), rules).errors.filter((e) => e.startsWith('services:'))).toEqual([]);
    const report = validate(input({ ...minor, compareWith: [] }), rules);
    expect(report.errors).toContain('services: "s3" thiếu compareWith');
  });

  it('requires the filename and service registry metadata to match the note', () => {
    const mismatch = { ...input(note()), noteIds: ['other'], serviceNotes: [note({ category: 'Compute' })] };
    const report = validate(mismatch, rules);
    expect(report.errors).toContain('services: ghi chú "s3" không khớp name/category trong service-registry.json');
    expect(report.errors).toContain('services: thiếu file data/services/s3.json');
  });
});
