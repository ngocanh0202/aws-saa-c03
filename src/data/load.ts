import main from '../../data/main.json';
import questions from '../../data/questions.json';
import registry from '../../data/service-registry.json';
import sets from '../../data/sets.json';
import { buildBank } from './bank';
import { expandMainMetas, expandTwins } from './main-meta';
import type { ExternalSet, MainFile, Question, QuestionMeta, QuestionVi, ServiceNote, ServiceRef, SetsFile } from './types';

const mainMetaFiles = import.meta.glob<QuestionMeta[]>('../../data/main-meta/*.json', { eager: true, import: 'default' });
const metaFiles = import.meta.glob<QuestionMeta[]>('../../data/meta/*.json', { eager: true, import: 'default' });
const viFiles = import.meta.glob<QuestionVi[]>('../../data/vi/*.json', { eager: true, import: 'default' });
const mainViFiles = import.meta.glob<QuestionVi[]>('../../data/main-vi/*.json', { eager: true, import: 'default' });
const externalFiles = import.meta.glob<ExternalSet>('../../data/external/*.json', { eager: true, import: 'default' });
const externalViFiles = import.meta.glob<QuestionVi[]>('../../data/external-vi/*/*.json', { eager: true, import: 'default' });
const serviceNoteFiles = import.meta.glob<ServiceNote>('../../data/services/*.json', { eager: true, import: 'default' });

const mainFile = main as unknown as MainFile;

export const bank = buildBank({
  questions: [...(questions as unknown as Question[]), ...mainFile.questions],
  metas: [...Object.values(metaFiles).flat(), ...expandMainMetas(Object.values(mainMetaFiles).flat(), mainFile.twins)],
  vis: [...Object.values(viFiles).flat(), ...expandTwins(Object.values(mainViFiles).flat(), mainFile.twins)],
  registry: registry as unknown as ServiceRef[],
  serviceNotes: Object.values(serviceNoteFiles),
  sets: sets as unknown as SetsFile,
  mainSets: mainFile.sets,
  externals: Object.values(externalFiles),
  externalVis: groupBySlug(externalViFiles),
});

// data/external-vi/<slug>/<lô>.json → { slug: [...] }
function groupBySlug(files: Record<string, QuestionVi[]>): Record<string, QuestionVi[]> {
  const out: Record<string, QuestionVi[]> = {};
  for (const [path, vis] of Object.entries(files)) {
    const slug = path.split('/').slice(-2)[0];
    out[slug] = [...(out[slug] ?? []), ...vis];
  }
  return out;
}
