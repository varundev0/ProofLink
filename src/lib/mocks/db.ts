import fs from 'fs';
import path from 'path';

export type Project = {
  uuid: string;
  freelancerEmail: string;
  title: string;
  amount: number;
  status: 'pending' | 'paid';
  proofFileUrl?: string;
  finalFileUrl?: string; // Private
};

export type Profile = {
  deal_count: number;
};

type DbSchema = {
  projects: Record<string, Project>;
  profiles: Record<string, Profile>;
};

const DB_PATH = path.join(process.cwd(), 'src/lib/mocks/data.json');

const readDb = (): DbSchema => {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { projects: {}, profiles: {} };
  }
};

const writeDb = (data: DbSchema) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
};

export const db = {
  getProject: (uuid: string): Project | undefined => {
    const data = readDb();
    return data.projects[uuid];
  },
  createProject: (project: Project) => {
    const data = readDb();
    data.projects[project.uuid] = project;
    writeDb(data);
  },
  updateProjectStatus: (uuid: string, status: 'pending' | 'paid') => {
    const data = readDb();
    if (data.projects[uuid]) {
      data.projects[uuid].status = status;
      writeDb(data);
    }
  },
  getProfile: (id: string): Profile => {
    const data = readDb();
    return data.profiles[id] || { deal_count: 0 };
  },
  incrementDealCount: (id: string) => {
    const data = readDb();
    if (!data.profiles[id]) data.profiles[id] = { deal_count: 0 };
    data.profiles[id].deal_count += 1;
    writeDb(data);
  }
};
