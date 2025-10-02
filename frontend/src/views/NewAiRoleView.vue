<template>
  <section class="new-ai-role">
    <header>
      <h2>Create a Custom AI Role</h2>
      <p>Craft unique personalities and guardrails for your AI companion.</p>
    </header>
    <form class="builder" @submit.prevent="createRole">
      <label>
        Role name
        <input v-model="form.name" required />
      </label>
      <label>
        Personality archetype
        <select v-model="form.archetype">
          <option value="supportive">Supportive</option>
          <option value="playful">Playful</option>
          <option value="intellectual">Intellectual</option>
          <option value="mysterious">Mysterious</option>
        </select>
      </label>
      <label>
        Prompt primer
        <textarea v-model="form.prompt" rows="5" placeholder="System prompt directives" />
      </label>
      <label>
        Safety guardrails
        <textarea v-model="form.guardrails" rows="3" placeholder="Content limits, escalation rules" />
      </label>
      <button type="submit">Create role</button>
    </form>
  </section>
</template>

<script setup>
import { reactive } from 'vue';

const form = reactive({
  name: '',
  archetype: 'supportive',
  prompt: '',
  guardrails: '',
});

function createRole() {
  console.info('create AI role placeholder', form);
}
</script>

<style scoped>
.new-ai-role {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 640px;
}

.builder {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background: rgba(12, 15, 24, 0.92);
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  color: #cbd5f5;
}

input,
textarea,
select {
  border-radius: 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(15, 19, 28, 0.7);
  color: inherit;
  padding: 0.75rem 1rem;
}

button {
  border: none;
  border-radius: 999px;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #f472b6, #c084fc);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  align-self: flex-start;
}
</style>
