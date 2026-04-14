/* =====================================================
   Agent-related types used across pages and modals.
   ===================================================== */

export type Ability = {
  slot: string;
  displayName: string;
  description: string;
  displayIcon?: string | null;
};

export type Role = {
  displayName: string;
  description: string;
  displayIcon?: string | null;
};

export type Agente = {
  displayName: string;
  description: string;
  displayIcon?: string | null;
  fullPortrait?: string | null;
  background?: string | null;
  role: Role;
  abilities: Ability[];
};

/**
 * Lightweight agent content shape returned by the /content/agentes
 * endpoint. Used in modals to resolve agent metadata.
 */
export type AgentContent = {
  uuid?: string;
  id?: string;
  displayName?: string;
  name?: string;
  displayIcon?: string;
  displayIconSmall?: string;
  description?: string;
  role?: {
    displayName?: string;
    description?: string;
    displayIcon?: string;
  };
  abilities?: Array<{
    slot?: string;
    displayName?: string;
    description?: string;
    displayIcon?: string | null;
  }>;
};
