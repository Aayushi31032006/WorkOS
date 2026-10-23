/**
 * Synthetic company definitions for development and testing.
 * These are NEVER real companies and contain no production data.
 */

export interface SyntheticCompany {
  id: string;
  name: string;
  slug: string;
  department_ids: { id: string; name: string }[];
  project_ids: { id: string; name: string }[];
}

export const COMPANY_ACME: SyntheticCompany = {
  id: "a0000000-0000-4000-a000-000000000001",
  name: "Acme Corp",
  slug: "acme",
  department_ids: [
    { id: "d0000000-0000-4000-a000-000000000011", name: "Engineering" },
    { id: "d0000000-0000-4000-a000-000000000012", name: "Product" },
    { id: "d0000000-0000-4000-a000-000000000013", name: "Design" },
  ],
  project_ids: [
    { id: "p0000000-0000-4000-a000-000000000021", name: "Project Phoenix" },
    { id: "p0000000-0000-4000-a000-000000000022", name: "Project Atlas" },
  ],
};

export const COMPANY_GLOBEX: SyntheticCompany = {
  id: "b0000000-0000-4000-b000-000000000002",
  name: "Globex Industries",
  slug: "globex",
  department_ids: [
    { id: "d0000000-0000-4000-b000-000000000014", name: "Research" },
    { id: "d0000000-0000-4000-b000-000000000015", name: "Operations" },
  ],
  project_ids: [
    { id: "p0000000-0000-4000-b000-000000000023", name: "Project Omega" },
  ],
};

export const ALL_COMPANIES = [COMPANY_ACME, COMPANY_GLOBEX] as const;
