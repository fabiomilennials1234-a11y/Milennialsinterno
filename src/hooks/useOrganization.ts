import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface KanbanBoardInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface OrganizationGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  product_category_id: string | null;
  squads: Squad[];
  coringaBoards: KanbanBoardInfo[]; // Boards for coringas at group level
}

export interface Squad {
  id: string;
  group_id: string;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  boards: KanbanBoardInfo[]; // Boards within the squad
}

export interface IndependentCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  position: number;
  boards: KanbanBoardInfo[]; // Boards for this category
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  position: number;
  parent_category_id: string | null;
  groups: OrganizationGroup[];
  subcategories: ProductCategory[]; // Subcategorias aninhadas
  boards: KanbanBoardInfo[]; // Boards linked directly to this category
}

export function useOrganizationGroups() {
  return useQuery({
    queryKey: ['organization-groups'],
    queryFn: async (): Promise<OrganizationGroup[]> => {
      // Fetch groups
      const { data: groups, error: groupsError } = await supabase
        .from('organization_groups')
        .select('*')
        .order('position', { ascending: true });

      if (groupsError) throw groupsError;
      if (!groups) return [];

      // Fetch squads
      const { data: squads } = await supabase
        .from('squads')
        .select('*')
        .order('position', { ascending: true });

      // Fetch boards with organizational links
      const { data: boards } = await supabase
        .from('kanban_boards')
        .select('id, name, slug, description, group_id, squad_id')
        .order('name', { ascending: true });

      // Map squads with their boards
      const squadMap = squads?.map(squad => ({
        id: squad.id,
        group_id: squad.group_id,
        name: squad.name,
        slug: squad.slug,
        description: squad.description,
        position: squad.position,
        boards: boards?.filter(b => b.squad_id === squad.id).map(b => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          description: b.description,
        })) || [],
      })) || [];

      // Map groups with squads and coringa boards
      return groups.map(group => ({
        id: group.id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        position: group.position,
        product_category_id: group.product_category_id,
        squads: squadMap.filter(s => s.group_id === group.id),
        coringaBoards: boards?.filter(b => b.group_id === group.id && !b.squad_id).map(b => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          description: b.description,
        })) || [],
      }));
    },
  });
}

export function useIndependentCategories() {
  return useQuery({
    queryKey: ['independent-categories'],
    queryFn: async (): Promise<IndependentCategory[]> => {
      const { data: categories, error } = await supabase
        .from('independent_categories')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;
      if (!categories) return [];

      // Fetch boards linked to categories
      const { data: boards } = await supabase
        .from('kanban_boards')
        .select('id, name, slug, description, category_id')
        .order('name', { ascending: true });

      return categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        position: cat.position,
        boards: boards?.filter(b => b.category_id === cat.id).map(b => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          description: b.description,
        })) || [],
      }));
    },
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: ['product-categories'],
    queryFn: async (): Promise<ProductCategory[]> => {
      // Fetch product categories
      const { data: categories, error: catError } = await supabase
        .from('product_categories')
        .select('*')
        .order('position', { ascending: true });

      if (catError) throw catError;
      if (!categories) return [];

      // Fetch groups
      const { data: groups, error: groupsError } = await supabase
        .from('organization_groups')
        .select('*')
        .order('position', { ascending: true });

      if (groupsError) throw groupsError;

      // Fetch squads
      const { data: squads } = await supabase
        .from('squads')
        .select('*')
        .order('position', { ascending: true });

      // Fetch boards with organizational links INCLUDING product_category_id
      const { data: boards } = await supabase
        .from('kanban_boards')
        .select('id, name, slug, description, group_id, squad_id, product_category_id')
        .order('name', { ascending: true });

      // Map squads with their boards
      const squadMap = squads?.map(squad => ({
        id: squad.id,
        group_id: squad.group_id,
        name: squad.name,
        slug: squad.slug,
        description: squad.description,
        position: squad.position,
        boards: boards?.filter(b => b.squad_id === squad.id).map(b => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          description: b.description,
        })) || [],
      })) || [];

      // Map groups with squads and coringa boards
      const groupMap = groups?.map(group => ({
        id: group.id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        position: group.position,
        product_category_id: group.product_category_id,
        squads: squadMap.filter(s => s.group_id === group.id),
        coringaBoards: boards?.filter(b => b.group_id === group.id && !b.squad_id).map(b => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          description: b.description,
        })) || [],
      })) || [];

      // Função recursiva para construir hierarquia de categorias
      const buildCategoryHierarchy = (parentId: string | null): ProductCategory[] => {
        return categories
          .filter(cat => cat.parent_category_id === parentId)
          .map(cat => {
            // Get boards directly linked to this category via product_category_id
            const categoryBoards = boards?.filter(b => b.product_category_id === cat.id).map(b => ({
              id: b.id,
              name: b.name,
              slug: b.slug,
              description: b.description,
            })) || [];

            return {
              id: cat.id,
              name: cat.name,
              slug: cat.slug,
              icon: cat.icon,
              position: cat.position,
              parent_category_id: cat.parent_category_id,
              groups: groupMap.filter(g => g.product_category_id === cat.id),
              subcategories: buildCategoryHierarchy(cat.id),
              boards: categoryBoards, // Add boards directly linked to category
            };
          });
      };

      // Retornar apenas categorias de nível superior (sem parent)
      return buildCategoryHierarchy(null);
    },
  });
}

export function useSquads() {
  return useQuery({
    queryKey: ['squads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('squads')
        .select('*, organization_groups(name, slug)')
        .order('position', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
}
