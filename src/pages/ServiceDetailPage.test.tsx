import { screen } from '@testing-library/react';
import { makeDeps, renderApp } from '../test/fixtures';

describe('service note detail', () => {
  it('renders the guide sections and safe-practice cleanup', () => {
    const deps = makeDeps();
    deps.bank.serviceNotes.set('s3', {
      id: 's3',
      name: 'Amazon S3',
      category: 'Storage',
      tier: 'core',
      overview: 'Managed object storage.',
      concepts: [{ term: 'Bucket', desc: 'A container for objects.' }],
      howItWorks: 'Objects are addressed by keys inside buckets.',
      useCases: ['Store static assets.'],
      pricing: 'Charges depend on storage, requests, retrieval, and transfer.',
      examSignals: ['Object storage with high durability.'],
      compareWith: [{ service: 'Amazon EFS', diff: 'S3 stores objects; EFS provides shared file storage.' }],
      facts: ['Versioning preserves object versions.'],
      practice: {
        steps: ['Create a private test bucket.', 'Upload a test object.'],
        freeTier: 'Check current account eligibility and regional pricing.',
        cleanup: ['Delete the object, then delete the bucket.'],
      },
    });

    renderApp('/services/s3', deps);

    expect(screen.getByText('Managed object storage.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Khái niệm chính' })).toBeInTheDocument();
    expect(screen.getByText('S3 stores objects; EFS provides shared file storage.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Thực hành an toàn' })).toBeInTheDocument();
    expect(screen.getByText('Delete the object, then delete the bucket.')).toBeInTheDocument();
  });
});
