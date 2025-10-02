<template>
  <section class="store-view">
    <header
      :class="[
        'store-hero',
        selectedMode === 'coins' ? 'hero--coins' : 'hero--vip',
      ]"
    >
      <div class="hero-icon">
        <img class="hero-image" :src="heroInfo.icon" alt="" />
      </div>
      <div class="hero-copy">
        <p class="hero-label">{{ heroInfo.label }}</p>
        <strong class="hero-balance">{{ heroInfo.primary }}</strong>
        <p class="hero-subtext">{{ heroInfo.secondary }}</p>
        <p v-if="heroInfo.meta" class="hero-meta">{{ heroInfo.meta }}</p>
      </div>
    </header>

    <div class="purchase-toggle" role="tablist">
      <button
        v-for="mode in purchaseModes"
        :key="mode.id"
        type="button"
        :class="['toggle-button', { active: selectedMode === mode.id }]"
        @click="selectedMode = mode.id"
        role="tab"
        :aria-selected="selectedMode === mode.id"
      >
        {{ mode.label }}
      </button>
    </div>

    <transition name="fade" mode="out-in">
      <div v-if="selectedMode === 'coins'" key="coins" class="coins-pane">
        <h3 class="section-title">金幣方案</h3>
        <div class="coins-grid">
          <button
            v-for="pack in coinPacks"
            :key="pack.id"
            type="button"
            class="coin-card"
            @click="purchaseCoins(pack.id)"
          >
            <div class="coin-meta">
              <img class="coin-icon" :src="coinImage" alt="" />
              <span class="coin-amount">{{ pack.amount }}</span>
            </div>
            <span class="coin-price">{{ pack.price }}</span>
          </button>
        </div>
      </div>
      <div v-else key="vip" class="vip-pane">
        <article class="vip-card">
          <header class="vip-header">
            <div class="vip-icon">
              <img class="vip-image" :src="vipImage" alt="" />
            </div>
            <div>
              <p class="vip-label">VIP 月卡</p>
              <h3>Love Story VIP Membership</h3>
              <p class="vip-tagline">
                解鎖全部特權 {{ activeVipPlan.durationLabel }}
              </p>
            </div>
          </header>

          <div class="vip-plan-toggle" role="tablist">
            <button
              v-for="plan in vipPlans"
              :key="plan.id"
              type="button"
              :class="[
                'vip-plan-button',
                { active: selectedVipPlan === plan.id },
              ]"
              @click="selectedVipPlan = plan.id"
              role="tab"
              :aria-selected="selectedVipPlan === plan.id"
            >
              <span class="plan-label">{{ plan.label }}</span>
              <span class="plan-price">{{ plan.priceLabel }}</span>
            </button>
          </div>

          <ul class="vip-benefits">
            <li v-for="benefit in vipBenefits" :key="benefit.title">
              <div class="benefit-icon"><img :src="benefit.icon" alt="" /></div>
              <div>
                <p class="benefit-title">{{ benefit.title }}</p>
                <p class="benefit-copy">{{ benefit.copy }}</p>
              </div>
            </li>
          </ul>

          <button
            class="vip-cta"
            type="button"
            @click="purchaseVip(activeVipPlan.id)"
          >
            馬上訂閱 {{ activeVipPlan.ctaLabel }}
          </button>
          <p class="vip-footnote">
            自動續訂，可隨時取消。查看
            <a href="/terms" class="vip-link">服務協定</a>
            &amp;
            <a href="/privacy" class="vip-link">隱私政策</a>
          </p>
        </article>
      </div>
    </transition>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import coinImage from "../assets/ls_gold_coin.png";
import vipImage from "../assets/is_metal.png";
import vipStickerImage from "../assets/vip_sticker_icon.png";
import freeBookImage from "../assets/free_book_icon.png";
import smartAiImage from "../assets/smart_ai_icon.png";
import chatWellImage from "../assets/chat_well_icon.png";
import { useRoute, useRouter } from "vue-router";
const coinBalance = ref(22);

const route = useRoute();
const router = useRouter();

const purchaseModes = [
  { id: "coins", label: "金幣" },
  { id: "vip", label: "VIP 月卡" },
];

const coinPacks = [
  { id: "coins-140", amount: "140", price: "$100.00" },
  { id: "coins-300", amount: "300", price: "$160.00" },
  { id: "coins-760", amount: "760", price: "$330.00" },
  { id: "coins-1500", amount: "1500", price: "$660.00" },
  { id: "coins-4000", amount: "4000", price: "$1,650.00" },
  { id: "coins-8400", amount: "8400", price: "$3,290.00" },
];

const vipPlans = [
  {
    id: "vip-monthly",
    label: "30 天",
    durationLabel: "30 天",
    priceLabel: "$330.00/月",
    ctaLabel: "$330.00/月",
  },
  {
    id: "vip-quarterly",
    label: "3 個月",
    durationLabel: "90 天",
    priceLabel: "$900.00/3 個月",
    ctaLabel: "$900.00/3 個月",
  },
  {
    id: "vip-yearly",
    label: "1 年",
    durationLabel: "365 天",
    priceLabel: "$3,200.00/年",
    ctaLabel: "$3,200.00/年",
  },
];

const vipBenefits = [
  { icon: vipStickerImage, title: "VIP 專屬貼圖", copy: "查看 VIP 專屬朋友圈" },
  { icon: freeBookImage, title: "小說免費觀看", copy: "免費閱讀所有小說章節" },
  { icon: smartAiImage, title: "更智能 AI", copy: "享受更智能 AI 模型" },
  { icon: chatWellImage, title: "無限暢聊", copy: "每天無限聊天次數" },
];

const selectedMode = ref("coins");
const allowedModes = new Set(["coins", "vip"]);

function resolveMode(value) {
  return typeof value === "string" && allowedModes.has(value) ? value : null;
}

function syncModeFromQuery(value) {
  const mode = resolveMode(value);
  if (mode && mode !== selectedMode.value) {
    selectedMode.value = mode;
  }
}

onMounted(() => {
  syncModeFromQuery(route.query.mode);
});

watch(
  () => route.query.mode,
  (mode) => {
    syncModeFromQuery(mode);
  }
);

watch(selectedMode, (mode) => {
  if (resolveMode(route.query.mode) === mode) {
    return;
  }
  router
    .replace({
      query: {
        ...route.query,
        mode,
      },
    })
    .catch(() => {});
});
const selectedVipPlan = ref("vip-monthly");

const activeVipPlan = computed(
  () =>
    vipPlans.find((plan) => plan.id === selectedVipPlan.value) ?? vipPlans[0]
);

const heroInfo = computed(() => {
  if (selectedMode.value === "coins") {
    return {
      label: "金幣餘額",
      primary: coinBalance.value.toString(),
      secondary: "補充金幣，隨時與 AI 暢聊",
      meta: "金幣可用於商城道具與配對加速",
      icon: coinImage,
    };
  }

  const plan = activeVipPlan.value;
  return {
    label: "VIP 方案",
    primary: plan.priceLabel,
    secondary: `方案時長：${plan.durationLabel}`,
    meta: "解鎖專屬貼圖、小說與無限暢聊",
    icon: vipImage,
  };
});

function purchaseCoins(packId) {
  console.info("purchase coins", packId);
}

function purchaseVip(planId) {
  console.info("purchase vip", planId);
}
</script>

<style scoped>
.store-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 2rem;
}

.store-hero {
  padding: 2rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  color: #ffeef8;
}

.hero--vip {
  background: radial-gradient(circle at top, #ff6fd8, #8c1aff 70%);
}
.hero--vip .hero-image {
  width: 8rem;
  height: 6rem;
  object-fit: contain;
}
.hero--coins {
  background: linear-gradient(
    162deg,
    #ad3460 0%,
    #7e2646 40%,
    #391522 83%,
    #391522 100%
  );
}
.hero--coins .hero-image {
  width: 6rem;
  height: 6rem;
  object-fit: contain;
}
.hero-icon {
  display: grid;
  place-items: center;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.hero-label {
  letter-spacing: 0.1em;
  font-size: 0.85rem;
}

.hero-balance {
  font-size: 2.3rem;
  line-height: 1;
}

.hero-subtext {
  font-size: 0.95rem;
  opacity: 0.85;
}

.hero-meta {
  font-size: 0.85rem;
  opacity: 0.75;
}

.purchase-toggle {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  background: rgba(16, 14, 44, 0.7);
  border-radius: 999px;
  padding: 0.4rem;
  gap: 0.4rem;
}

.toggle-button {
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #d4d7ff;
  font-weight: 600;
  padding: 0.65rem 1.2rem;
  transition: background 0.2s ease, color 0.2s ease;
  cursor: pointer;
}

.toggle-button.active {
  background: linear-gradient(135deg, #ff7ad5, #ff4e8e);
  color: #fff;
  box-shadow: 0 10px 20px rgba(255, 80, 170, 0.35);
}

.section-title {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  color: #fbe6ff;
  letter-spacing: 0.08em;
  padding: 0 1rem;
}

.coins-grid {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 0 1rem;
}

.coin-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: none;
  border-radius: 1.25rem;
  padding: 1rem 1.4rem;
  background: linear-gradient(135deg, #693146 30%, #693146 90%);
  color: #ffeef8;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.coin-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 20px rgba(136, 0, 120, 0.35);
}

.coin-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.coin-icon {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

.coin-amount {
  font-size: 1.4rem;
  font-weight: 700;
}

.coin-price {
  border-radius: 999px;
  padding: 0.55rem 1.4rem;
  background: linear-gradient(135deg, #ff7ad5, #ff4e8e);
  color: #fff;
  font-weight: 600;
}

.vip-card {
  background: linear-gradient(
    150deg,
    rgba(69, 9, 66, 0.95),
    rgba(24, 7, 48, 0.95)
  );
  border-radius: 1.5rem;
  padding: 2rem 1.8rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  color: #ffeef8;
  box-shadow: 0 18px 28px rgba(108, 0, 92, 0.35);
}

.vip-header {
  display: flex;
  gap: 1.2rem;
  align-items: center;
}

.vip-icon {
  display: grid;
  place-items: center;
}

.vip-image {
  width: 5rem;
  height: 3rem;
  object-fit: contain;
}

.vip-label {
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 230, 250, 0.85);
}

.vip-tagline {
  margin-top: 0.4rem;
  color: rgba(255, 230, 250, 0.85);
}

.vip-plan-toggle {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 0.6rem;
}

.vip-plan-button {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.08);
  padding: 0.75rem 1rem;
  color: #ffeef8;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  cursor: pointer;
  transition: border 0.2s ease, box-shadow 0.2s ease;
}

.vip-plan-button.active {
  border: 1px solid rgba(255, 116, 190, 0.8);
  box-shadow: 0 12px 20px rgba(255, 92, 173, 0.35);
  background: rgba(255, 116, 190, 0.18);
}

.plan-label {
  font-weight: 700;
}

.plan-price {
  font-size: 0.85rem;
  opacity: 0.85;
}

.vip-benefits {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.vip-benefits li {
  display: flex;
  gap: 1rem;
  align-items: center;
  background: rgba(255, 255, 255, 0.06);
  padding: 0.9rem 1rem;
  border-radius: 1rem;
}

.benefit-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.benefit-icon img {
  width: 100%;
  height: 100%;
}
.benefit-title {
  font-weight: 600;
}

.benefit-copy {
  font-size: 0.9rem;
  opacity: 0.8;
}

.vip-cta {
  border: none;
  border-radius: 999px;
  padding: 0.95rem;
  font-size: 1.05rem;
  font-weight: 700;
  background: linear-gradient(135deg, #ff77d5, #ff3e91);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 18px 30px rgba(255, 62, 145, 0.4);
}

.vip-footnote {
  font-size: 0.8rem;
  color: rgba(255, 235, 245, 0.7);
  text-align: center;
}

.vip-link {
  color: #ffd6f1;
  text-decoration: underline;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .store-hero {
    flex-direction: column;
    text-align: center;
  }

  .hero-copy {
    align-items: center;
  }

  .vip-header {
    flex-direction: column;
    text-align: center;
  }

  .vip-plan-toggle {
    grid-template-columns: 1fr;
  }
}
</style>
