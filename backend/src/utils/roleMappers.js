export function mapRoleToMatchCard(role) {
  if (!role) return null;

  const identifier = role.slug ?? role.id ?? null;
  const gender = role.gender ?? role.profile?.gender ?? null;
  const profile =
    role.profile && typeof role.profile === 'object' ? { ...role.profile } : null;

  if (profile && gender && !profile.gender) {
    profile.gender = gender;
  }

  return {
    id: identifier,
    slug: role.slug ?? role.id ?? null,
    gender,
    name: role.name,
    persona: role.persona,
    summary: role.summary,
    tags: Array.isArray(role.tags) ? role.tags : [],
    profile,
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
  const gender =
    role.gender ?? card?.gender ?? role.profile?.gender ?? '無性別';
  const profile = card?.profile ?? role.profile ?? null;
  const image = card?.portraitImageUrl ?? card?.coverImageUrl ?? role.portraitImageUrl ?? role.coverImageUrl ?? null;

  return {
    aiRoleId: role.id ?? role.slug ?? null,
    aiRoleSlug: role.slug ?? role.id ?? null,
    aiName: role.name,
    aiPersona: role.persona ?? '',
    bio: role.summary ?? role.persona ?? '',
    tags: Array.isArray(role.tags) ? role.tags : [],
    profile,
    gender,
    image,
    card,
  };
}

