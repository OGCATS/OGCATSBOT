const { Bot, InlineKeyboard } = require("grammy");

const BOT_TOKEN = process.env.BOT_TOKEN;
const COLLECTION_ADDRESS =
  "EQBPToJYD439p10lVOj8FJbXr_TACmuNG25P-SMb0MAE7XH2";

const bot = new Bot(BOT_TOKEN);

async function tonApi(path) {
  const response = await fetch(`https://tonapi.io/v2${path}`);

  if (!response.ok) {
    throw new Error(`TonAPI error: ${response.status}`);
  }

  return response.json();
}

function ton(value) {
  return Number(value) / 1_000_000_000;
}

function formatTon(value) {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 2
  })} TON`;
}

function getRarity(nft) {
  const attributes = nft.metadata?.attributes || [];

  const rarity = attributes.find(
    (a) =>
      String(a.trait_type || a.type || "").toLowerCase() === "rarity"
  );

  return rarity?.value || null;
}

function getSalePrice(nft) {
  if (!nft.sale) return null;

  const value =
    nft.sale.price?.value ??
    nft.sale.price ??
    nft.sale.full_price;

  if (!value) return null;

  return ton(value);
}

function getFloor(items) {
  const prices = items
    .map(getSalePrice)
    .filter((price) => price !== null && price > 0);

  return prices.length ? Math.min(...prices) : null;
}

function getGetGemsUrl(nft) {
  return `https://getgems.io/nft/${nft.address}`;
}

async function getItems() {
  const data = await tonApi(
    `/nfts/collections/${COLLECTION_ADDRESS}/items?limit=100`
  );

  return data.nft_items || [];
}

bot.command("start", async (ctx) => {
  await ctx.reply(
    "🐱 OG CATS BOT\n\n" +
    "/floor — общий floor коллекции\n" +
    "/floor 87 — проверить конкретного кота"
  );
});

bot.command("floor", async (ctx) => {
  try {
    const items = await getItems();

    const collectionFloor = getFloor(items);

    const rareFloor = getFloor(
      items.filter(
        (nft) => String(getRarity(nft)).toLowerCase() === "rare"
      )
    );

    const epicFloor = getFloor(
      items.filter(
        (nft) => String(getRarity(nft)).toLowerCase() === "epic"
      )
    );

    const legendaryFloor = getFloor(
      items.filter(
        (nft) =>
          String(getRarity(nft)).toLowerCase() === "legendary"
      )
    );

    const limitedFloor = getFloor(
      items.filter(
        (nft) =>
          String(getRarity(nft)).toLowerCase() === "limited"
      )
    );

    const argument = ctx.match?.trim();

    if (!argument) {
      await ctx.reply(
        `🐱 OG CATS FLOOR\n\n` +
        `Collection: ${formatTon(collectionFloor)}\n\n` +
        `FLOOR BY RARITY\n` +
        `🔹 Rare — ${formatTon(rareFloor)}\n` +
        `🔸 Epic — ${formatTon(epicFloor)}\n` +
        `🟣 Legendary — ${formatTon(legendaryFloor)}\n` +
        `💎 Limited — ${formatTon(limitedFloor)}\n\n` +
        `Чтобы проверить кота:\n` +
        `/floor 87`
      );

      return;
    }

    const number = Number(argument);

    if (!Number.isInteger(number) || number < 1) {
      await ctx.reply("Напиши номер NFT, например: /floor 87");
      return;
    }

    const nft = items.find((item) => {
      const name = item.metadata?.name || item.name || "";
      return name.includes(`#${number}`);
    });

    if (!nft) {
      await ctx.reply(`🐱 CATS #${number} не найден.`);
      return;
    }

    const nftPrice = getSalePrice(nft);

    let message =
      `🐱 CATS #${number}\n\n` +
      `Collection floor: ${formatTon(collectionFloor)}\n`;

    if (nftPrice !== null) {
      message +=
        `NFT price: ${formatTon(nftPrice)}\n` +
        `Status: ON SALE`;

      const keyboard = new InlineKeyboard().url(
        "🔗 Open on GetGems",
        getGetGemsUrl(nft)
      );

      await ctx.reply(message, {
        reply_markup: keyboard
      });
    } else {
      message +=
        `NFT price: —\n` +
        `Status: NOT FOR SALE`;

      await ctx.reply(message);
    }
  } catch (error) {
    console.error(error);

    await ctx.reply(
      "Не удалось получить данные OG CATS. Попробуй ещё раз."
    );
  }
});

bot.catch((error) => {
  console.error("Bot error:", error);
});

bot.start();

console.log("OG CATS Floor Bot started");
