// src/utils/regionTree.ts
import type { RegionDTO } from '@/services/regionClient';

export type RegionTreeNode = {
  region: RegionDTO;
  children: RegionTreeNode[];
};

export const slugifyLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

export const buildRegionHierarchy = (regions: RegionDTO[]): RegionTreeNode[] => {
  const nodeMap = new Map<string, RegionTreeNode>();
  regions.forEach(region =>
    nodeMap.set(region.slug, {
      region,
      children: [],
    })
  );

  const roots: RegionTreeNode[] = [];
  regions.forEach(region => {
    const node = nodeMap.get(region.slug);
    if (!node) return;
    if (region.parentSlug) {
      const parent = nodeMap.get(region.parentSlug);
      if (parent) {
        parent.children.push(node);
        parent.children.sort((a, b) => a.region.name.localeCompare(b.region.name));
        return;
      }
    }
    roots.push(node);
  });
  roots.sort((a, b) => a.region.name.localeCompare(b.region.name));
  return roots;
};

export const computeHierarchyLayout = (roots: RegionTreeNode[]) => {
  const widthMap = new Map<string, number>();

  const measure = (node: RegionTreeNode): number => {
    if (!node.children.length) {
      widthMap.set(node.region.slug, 1);
      return 1;
    }
    const total = node.children.map(measure).reduce((sum, value) => sum + value, 0);
    widthMap.set(node.region.slug, total);
    return total;
  };

  roots.forEach(measure);

  const positions = new Map<string, { x: number; y: number }>();
  const assign = (node: RegionTreeNode, depth: number, offset: number) => {
    const width = widthMap.get(node.region.slug) ?? 1;
    const center = offset + width / 2;
    positions.set(node.region.slug, {
      x: center * 140,
      y: depth * 120 + 40,
    });
    let cursor = offset;
    node.children.forEach(child => {
      const childWidth = widthMap.get(child.region.slug) ?? 1;
      assign(child, depth + 1, cursor);
      cursor += childWidth;
    });
  };

  let start = 0;
  roots.forEach(root => {
    const width = widthMap.get(root.region.slug) ?? 1;
    assign(root, 0, start);
    start += width + 1;
  });

  return Array.from(positions.entries()).reduce<Record<string, { x: number; y: number }>>(
    (acc, [slug, pos]) => {
      acc[slug] = pos;
      return acc;
    },
    {}
  );
};
