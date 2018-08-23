const bot = require('bbot')

/**
 * `text` branch types simply respond when regex pattern is met.
 * The second parameter defining branch options is not required, but helps ID
 * this branch handler in the logs.
 *
 * Test with "Hello bots!"
*/
bot.global.text(/(hi|hello).*bots/, (b) => b.respond('Hello 👋'), {
  id: 'hello-bots'
})

/**
 * `direct` branch type requires the bot to be explicitly addressed.
 * `reply` instead of `respond` prepends messages with user's name.
 * In Rocket.Chat all messages to a bot in a direct room have the name prepended
 * by the Rocket.Chat SDK before it's processed by the bot framework.
 *
 * Test with "bot Hello" or just "Hello" in a DM.
*/
bot.global.direct(/hi|hello/i, (b) => b.reply('Hey there.'), {
  id: 'hello-direct'
})

/**
 * `respondVia` allows using custom platform methods to dispatch response.
 *
 * Test with "Hello anyone?"
*/
bot.global.text(/hi|hello/i, (b) => b.respondVia('react', ':wave:'), {
  id: 'hello-react'
})

/**
 * `force: true` in the branch options object, run the branch callback on match
 * even when another branch has already matched. Otherwise only one will match.
 *
 * Test with "Hello baby!"
 */
bot.global.text(/baby/i, (b) => b.respondVia('react', ':baby:'), {
  id: 'baby-react', force: true
})

/**
 * Branch callbacks allow asynchronous responding, if they return a promise.
 * State (b) includes branch matching attributes, see bbot.chat/docs/thought.
 *
 * Test with "bot ping back in 5 seconds"
*/
bot.global.direct(/ping back in (\d*)/i, async (b) => {
  const ms = parseInt(b.match[1]) * 1000
  await new Promise((resolve) => setTimeout(resolve, ms))
  return b.respond('Ping 🏓')
}, {
  id: 'ping-delay'
})

/**
 * The `respond` method can accept attachment objects as well as strings.
 * Rendering support depends on the message platform and adapter. In shell,
 * it will display the fallback text.
 *
 * Test with "bot attach image"
 */
bot.global.text(/attach image/i, (b) => {
  return b.respond({
    fallback: `See: https://www.wikiwand.com/en/Three_Laws_of_Robotics`,
    image: `https://upload.wikimedia.org/wikipedia/en/8/8e/I_Robot_-_Runaround.jpg`,
    title: {
      text: `Asimov's Three Laws of Robotics`,
      link: `https://www.wikiwand.com/en/Three_Laws_of_Robotics`
    }
  })
}, { id: 'attach-image' })

/**
 * The state `match` attribute contains the results from the matching function
 * that triggered the current branch callback. In this case, a regex match, but
 * custom matchers might have different structure.
 *
 * Test with "what's behind door number 2"
 */
bot.global.text(/door number ([1-3]{1})/, (b) => {
  switch (b.match[1]) {
    case '1': return b.respond(`You win nothing 💔`)
    case '2': return b.respond(`You win a monkey 🐒`)
    case '3': return b.respond(`It's a new car!! 🚗`)
  }
}, { id: 'door-prize' })

/**
 * `request` provides simple interfaces for making external requests, allowing
 * you to make use of external content in branch callbacks.
 *
 * Test with "Beetlejuice awards?"
 */
bot.global.text(/(.*) awards/i, (b) => {
  const apiKey = process.env.OMDB_API_KEY
  if (!apiKey) return b.respond('Sorry, you need an API key for omdbapi.com')
  return b.bot.request.get(`http://www.omdbapi.com/`, {
    t: b.match[1],
    apikey: apiKey
  }).then((film) => {
    if (film.Response === 'True') {
      return (film.Awards === 'N/A')
        ? b.respond(`${b.match[1]} (${film.Year}): Won no awards.`)
        : b.respond(`${b.match[1]} (${film.Year}): ${film.Awards}`)
    } else {
      return b.respond(`Can't find any film by that name.`)
    }
  })
})

/**
 * Bot settings can be defined at run time, overruling environment and cli args.
 *
 * In this case, we rename the bot to match the example descriptions below.
 */
bot.settings.set('name', 'bot')

/**
 * Custom options can be added to the bot, with the full config utility of bBot,
 * allowing them to be defined as environment variables, command line args or
 * package.json attributes. Extend settings with a yargs option format.
 *
 * Try any of the following (with the next example):
 *  - `node index.js --flag <YOUR_FLAG>`
 *  - `BOT_FLAG=<YOUR_FLAG>` in .env
 *  - `{ "bot": { "flag": "<YOUR_FLAG>" } }` in package.json
 */
bot.settings.extend({
  flag: {
    'type': 'string',
    'description': 'Set a custom flag emoji to give your bot local flair.',
    'default': '🏳️‍🌈'
  }
})

/**
 * Settings can change the bot's operation, or add attributes for callbacks.
 *
 * Test with "bot where are you from"
 */
bot.global.direct(/where are you from/i, (b) => {
  return b.respond(`${bot.settings.get('flag')}`)
}, { id: 'where-from' })

/**
 * The bot can remember any key/value pair, collecting data to use in
 * later callbacks.
 *
 * Test with "beetlejuice" three times.
 */
bot.global.text(/beetlejuice/i, (b) => {
  let beetles = b.bot.memory.get('beetles') || 0
  beetles = beetles + 1
  b.bot.memory.set('beetles', beetles)
  bot.logger.warn(JSON.stringify(b.bot.memory.private))
  bot.logger.warn(require('util').inspect(beetles, false, 2))
  switch (beetles) {
    case 1: return b.respond('☝️️️')
    case 2: return b.respond('✌️')
    case 3: return b.respond('🐞')
    default: return b.respond('😱')
  }
}, { id: 'beetlejuice' })

/**
 * `hear` middleware can interrupt the thought process, preventing the bot from
 * taking any action on messages matching certain criteria.
 * Call `done()` to exit further processing or `next()` to continue.
 *
 * Test with "hello all" and "hello users"
 */
bot.middleware.hear((b, next, done) => {
  if (b.message.toString().match(/users/i)) done()
  else next()
})

/**
 * `listen` middleware fires on every matching branch, to interrupt, modify or
 * analyse state. This example limits the frequency of the bot's reactions.
 *
 * Test with "hello" multiple times.
 */
bot.middleware.listen((b, next, done) => {
  if (b.branch.id !== 'hello-react') return next()
  const now = new Date()
  const limit = 3 * 1000
  const lastTime = new Date(b.bot.memory.get('reacted') || 0)
  const limitTime = new Date(lastTime.getTime() + limit)
  if (now > limitTime) {
    b.bot.memory.set('reacted', now)
    next()
  } else {
    bot.logger.warn(`ignoring hello until ${limitTime} (now :${now})`)
    done()
  }
})

/**
 * `middleware` respond executes when the bot dispatches messages. It can be
 * used to interrupt or modify state. Respond state includes an array of
 * envelopes (one from each respond, if multiple branches respond to a state),
 * each with an array of strings or rich message payload.
 *
 * This example censors the bot from giving away the same car twice.
 *
 * Test with "door number 3" twice in a row
 */
bot.middleware.respond((b, next, done) => {
  const car = b.bot.memory.get('spare-car') || '🚗'
  b.envelopes.map((envelope, index) => {
    if (envelope.strings) {
      b.envelopes[index].strings = envelope.strings.map((text) => {
        if (text.indexOf('🚗') >= 0) {
          if (car !== '🚗') {
            text = text.replace('🚗', car)
            b.bot.memory.set('spare-car', '🚗')
          } else {
            bot.logger.warn(`Gave away the ${car}, better get out the 🚙`)
            b.bot.memory.set('spare-car', '🚙')
          }
        }
        return text
      })
    }
  })
})