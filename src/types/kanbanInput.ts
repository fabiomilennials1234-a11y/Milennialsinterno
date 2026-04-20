// Tipos de entrada para criação de cards em cada board especializado.
// Centraliza o payload que vem dos modais e chega nos handlers.

export interface CardAttachmentInput {
  file: File;
  name: string;
  size: number;
  type: string;
}

export interface BaseCardInput {
  title: string;
  description?: string;
  priority?: 'normal' | 'urgent';
  due_date?: string;
  column_id?: string;
  status?: string;
}

export interface AtrizesCardInput extends BaseCardInput {
  briefing?: {
    client_instagram?: string;
    script_url?: string;
    drive_upload_url?: string;
  };
}

export interface DesignCardInput extends BaseCardInput {
  briefing?: {
    description?: string;
    references_url?: string;
    identity_url?: string;
    client_instagram?: string;
    script_url?: string;
  };
}

export interface VideoCardInput extends BaseCardInput {
  briefing?: {
    script_url?: string;
    observations?: string;
    materials_url?: string;
    reference_video_url?: string;
    identity_url?: string;
  };
}

export interface ProdutoraCardInput extends BaseCardInput {
  briefing?: {
    script_url?: string;
    observations?: string;
    reference_video_url?: string;
  };
}

export interface DevsCardInput extends BaseCardInput {
  briefing?: {
    description?: string;
    references_url?: string;
  };
  materials_url?: string;
  attachments?: CardAttachmentInput[];
}

// Usado pelo board genérico (KanbanBoard.tsx) quando renderiza Design/Video
// pelo slug. Briefing é opcional e heterogêneo.
export interface GenericCardInput extends BaseCardInput {
  briefing?: DesignCardInput['briefing'] | VideoCardInput['briefing'];
}
