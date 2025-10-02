import { createAiRole, getAiRoleById, listAiRoles, updateAiRole } from '../services/roleService.js';

const ALLOWED_STATUSES = new Set(['draft', 'review', 'published', 'retired']);

function normalizeStatus(value) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (!ALLOWED_STATUSES.has(normalized)) {
    const error = new Error('status 參數不合法');
    error.status = 400;
    throw error;
  }
  return normalized;
}

export async function listRoles(req, res, next) {
  try {
    const status = normalizeStatus(req.query?.status);
    const roles = await listAiRoles({ ensureSeed: true, status });
    res.json({ data: roles });
  } catch (error) {
    next(error);
  }
}

export async function getRole(req, res, next) {
  try {
    const role = await getAiRoleById(req.params.id, { ensureSeed: true });
    res.json({ data: role });
  } catch (error) {
    next(error);
  }
}

export async function createRole(req, res, next) {
  try {
    const role = await createAiRole(req.body ?? {});
    res.status(201).json({ data: role });
  } catch (error) {
    next(error);
  }
}

export async function updateRole(req, res, next) {
  try {
    const role = await updateAiRole(req.params.id, req.body ?? {});
    res.json({ data: role });
  } catch (error) {
    next(error);
  }
}
