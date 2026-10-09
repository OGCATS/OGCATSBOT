
const { Bot, InlineKeyboard } = require("grammy");

const BOT_TOKEN = process.env.BOT_TOKEN;
const COLLECTION_ADDRESS =
  "EQBPToJYD439p10lVOj8FJbXr_TACmuNG25P-SMb0MAE7XH2";

const bot = new Bot(BOT_TOKEN);

// Premium emoji
function premiumEmoji(id, fallback) {
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}

const CAT = premiumEmoji("5382167047834730380", "🐱");
const RARE = premiumEmoji("5453927296991792582", "🔹");
const EPIC = premiumEmoji("5453895424039486644", "🔸");
const LEGENDARY = premiumEmoji("5454065135377222655", "🟣");
const LIMITED = premiumEmoji("5453896643810198432", "💎");

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

function toFriendlyAddress(rawAddress) {
  const [workchain, hex] = rawAddress.split(":");

  const addressBytes = Buffer.alloc(34);
  addressBytes[0] = 0x11;
  addressBytes[1] = Number(workchain);
  Buffer.from(hex, "hex").copy(addressBytes, 2);

  let crc = 0;

  for (const byte of addressBytes) {
    crc ^= byte << 8;

    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000)
        ? ((crc << 1) ^ 0x1021)
        : (crc << 1);

      crc &= 0xffff;
    }
  }

  const result = Buffer.concat([
    addressBytes,
    Buffer.from([crc >> 8, crc & 0xff])
  ]);

  return result
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function getGetGemsUrl(nft) {
  const nftAddress = toFriendlyAddress(nft.address);

  return `https://getgems.io/collection/${COLLECTION_ADDRESS}/${nftAddress}`;
}

async function getItems() {
  const allItems = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const data = await tonApi(
      `/nfts/collections/${COLLECTION_ADDRESS}/items?limit=${limit}&offset=${offset}`
    );

    const items = data.nft_items || [];
    allItems.push(...items);

    if (items.length < limit) break;

    offset += limit;
  }

  return allItems;
}

// START
bot.command("start", async (ctx) => {
  const message =
    `${CAT} <b>OG CATS FLOOR</b>\n\n` +
    `Collection: 8 TON\n\n` +
    `<b>FLOOR BY RARITY</b>\n` +
    `${RARE} Rare — 9.8 TON\n` +
    `${EPIC} Epic — 8 TON\n` +
    `${LEGENDARY} Legendary — —\n` +
    `${LIMITED} Limited — —\n\n` +
    `Чтобы проверить кота:\n` +
    `<code>/floor 67</code>`;

  await ctx.reply(message, {
    parse_mode: "HTML"
  });
});

// FLOOR
bot.command("floor", async (ctx) => {
  try {
    const argument = ctx.match?.trim();

    // If a number is provided, find that NFT directly.
    // Otherwise, calculate the collection and rarity floors.
    if (argument) {
      const number = Number(argument);

      if (!Number.isInteger(number) || number < 1) {
        await ctx.reply("Напиши номер NFT, например: /floor 67");
        return;
      }

      const items = await getItems();

      const nft = items.find((item) => {
        const name = item.metadata?.name || item.name || "";
        return name.includes(`#${number}`);
      });

      if (!nft) {
        await ctx.reply(`${CAT} CATS #${number} не найден.`, {
          parse_mode: "HTML"
        });
        return;
      }

      const collectionFloor = getFloor(items);
      const nftPrice = getSalePrice(nft);

      let message =
        `${CAT} <b>CATS #${number}</b>\n\n` +
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
          parse_mode: "HTML",
          reply_markup: keyboard
        });
      } else {
        message +=
          `NFT price: —\n` +
          `Status: NOT FOR SALE`;

        await ctx.reply(message, {
          parse_mode: "HTML"
        });
      }

      return;
    }

    // Collection floor and rarity floors
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
        (nft) => String(getRarity(nft)).toLowerCase() === "legendary"
      )
    );

    const limitedFloor = getFloor(
      items.filter(
        (nft) => String(getRarity(nft)).toLowerCase() === "limited"
      )
    );

    const message =
      `${CAT} <b>OG CATS FLOOR</b>\n\n` +
      `Collection: ${formatTon(collectionFloor)}\n\n` +
      `<b>FLOOR BY RARITY</b>\n` +
      `${RARE} Rare — ${formatTon(rareFloor)}\n` +
      `${EPIC} Epic — ${formatTon(epicFloor)}\n` +
      `${LEGENDARY} Legendary — ${formatTon(legendaryFloor)}\n` +
      `${LIMITED} Limited — ${formatTon(limitedFloor)}\n\n` +
      `Чтобы проверить кота:\n` +
      `<code>/floor 67</code>`;

    await ctx.reply(message, {
      parse_mode: "HTML"
    });
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
