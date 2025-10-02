export function mapRoleToMatchCard(role) {
  if (!role) return null;

  return {
    id: role.id,
    name: role.name,
    persona: role.persona,
    summary: role.summary,
    tags: Array.isArray(role.tags) ? role.tags : [],
    profile: role.profile ?? null,
    coverImageUrl: role.coverImageUrl,
    portraitImageUrl: role.portraitImageUrl ?? null,
    accentColor: role.accentColor ?? null,
    sampleMessages: Array.isArray(role.sampleMessages) ? role.sampleMessages : [],
    pricing: role.pricing ?? { access: 'free', coins: 0 },
    metrics: role.metrics ?? { likes: 0, favorites: 0, conversationCount: 0 },
  };
}

export function mapRoleToConversationMetadata(role) {
  if (!role) return null;

  const card = mapRoleToMatchCard(role);

  return {
    aiRoleId: role.id,
    aiName: role.name,
    aiPersona: role.persona ?? '',
    bio: role.summary ?? role.persona ?? '',
    tags: Array.isArray(role.tags) ? role.tags : [],
    profile: role.profile ?? null,
    image: role.portraitImageUrl ?? role.coverImageUrl ?? null,
    card,
  };
}

