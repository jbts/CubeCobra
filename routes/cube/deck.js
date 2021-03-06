const express = require('express');
const { body } = require('express-validator');
const { Canvas, Image } = require('canvas');

Canvas.Image = Image;

const miscutil = require('../../dist/utils/Util.js');
const carddb = require('../../serverjs/cards.js');
const deckutil = require('../../dist/utils/Draft.js');
const { render } = require('../../serverjs/render');
const util = require('../../serverjs/util.js');
const generateMeta = require('../../serverjs/meta.js');
const cardutil = require('../../dist/utils/Card.js');
const { ensureAuth } = require('../middleware');

const { buildIdQuery, abbreviate, addDeckCardAnalytics, removeDeckCardAnalytics } = require('../../serverjs/cubefn.js');

const { exportToMtgo, createDraftForSingleDeck, DEFAULT_BASICS } = require('./helper.js');

// Bring in models
const Cube = require('../../models/cube');
const Deck = require('../../models/deck');
const User = require('../../models/user');
const CubeAnalytic = require('../../models/cubeAnalytic');
const Draft = require('../../models/draft');
const GridDraft = require('../../models/gridDraft');

const router = express.Router();

router.get('/download/xmage/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();

    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(`NAME:${seat.name}\r\n`);
    const main = {};
    for (const col of seat.deck) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `[${details.set.toUpperCase()}:${details.collector_number}] ${details.name}`;
        if (main[name]) {
          main[name] += 1;
        } else {
          main[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value} ${key}\r\n`);
    }

    const side = {};
    for (const col of seat.sideboard) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `[${details.set.toUpperCase()}:${details.collector_number}] ${details.name}`;
        if (side[name]) {
          side[name] += 1;
        } else {
          side[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`SB: ${value} ${key}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/forge/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('[metadata]\r\n');
    res.write(`Name=${seat.name}\r\n`);
    res.write('[Main]\r\n');
    const main = {};
    for (const col of seat.deck) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `${details.name}|${details.set.toUpperCase()}`;
        if (main[name]) {
          main[name] += 1;
        } else {
          main[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value} ${key}\r\n`);
    }

    res.write('[Side]\r\n');
    const side = {};
    for (const col of seat.sideboard) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `${details.name}|${details.set.toUpperCase()}`;
        if (side[name]) {
          side[name] += 1;
        } else {
          side[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`${value} ${key}\r\n`);
    }

    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/txt/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const col of seat.deck) {
      for (const card of col) {
        const { name } = carddb.cardFromId(card.cardID);
        res.write(`${name}\r\n`);
      }
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/mtgo/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];
    return exportToMtgo(res, seat.name, seat.deck.flat(), seat.sideboard.flat());
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/arena/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('Deck\r\n');
    const main = {};
    for (const col of seat.deck) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `${details.name} (${details.set.toUpperCase()}) ${details.collector_number}`;
        if (main[name]) {
          main[name] += 1;
        } else {
          main[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value} ${key}\r\n`);
    }

    res.write('\r\nSideboard\r\n');
    const side = {};
    for (const col of seat.sideboard) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `${details.name} (${details.set.toUpperCase()}) ${details.collector_number}`;
        if (side[name]) {
          side[name] += 1;
        } else {
          side[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`${value} ${key}\r\n`);
    }

    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/cockatrice/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    const main = {};
    for (const col of seat.deck) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `${details.name}`;
        if (main[name]) {
          main[name] += 1;
        } else {
          main[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value}x ${key}\r\n`);
    }

    res.write('Sideboard\r\n');
    const side = {};
    for (const col of seat.sideboard) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `${details.name}`;
        if (side[name]) {
          side[name] += 1;
        } else {
          side[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`${value}x ${key}\r\n`);
    }

    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.delete('/deletedeck/:id', ensureAuth, async (req, res) => {
  try {
    const query = {
      _id: req.params.id,
    };

    const deck = await Deck.findById(req.params.id);
    const deckOwner = (await User.findById(deck.seats[0].userid)) || {};

    if (!deckOwner._id.equals(req.user._id) && !deck.cubeOwner === req.user._id) {
      req.flash('danger', 'Unauthorized');
      return res.redirect('/404');
    }

    await Deck.deleteOne(query);

    req.flash('success', 'Deck Deleted');
    return res.send('Success');
  } catch (err) {
    return res.status(500).send({
      success: 'false',
      message: 'Error deleting deck.',
    });
  }
});

router.get('/deckbuilder/:id', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.redirect('/404');
    }
    const draft = deck.draft
      ? (await Draft.findById(deck.draft).lean()) || (await GridDraft.findById(deck.draft).lean())
      : null;

    const deckOwner = await User.findById(deck.seats[0].userid).lean();

    if (!req.user || !deckOwner._id.equals(req.user._id)) {
      req.flash('danger', 'Only logged in deck owners can build decks.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    const cube = await Cube.findOne(buildIdQuery(deck.cube), `${Cube.LAYOUT_FIELDS} basics useCubeElo`).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    let eloOverrideDict = {};
    if (cube.useCubeElo) {
      const analytic = await CubeAnalytic.findOne({ cube: cube._id });
      eloOverrideDict = util.fromEntries(analytic.cards.map((c) => [c.cardName, c.elo]));
    }

    // add details to cards
    for (const seat of deck.seats) {
      for (const collection of [seat.deck, seat.sideboard]) {
        for (const pack of collection) {
          for (const card of pack) {
            card.details = carddb.cardFromId(card.cardID);
            if (eloOverrideDict[card.details.name_lower]) {
              card.details.elo = eloOverrideDict[card.details.name_lower];
            }
          }
        }
      }
      for (const card of seat.pickorder) {
        card.details = carddb.cardFromId(card.cardID);
        if (eloOverrideDict[card.details.name_lower]) {
          card.details.elo = eloOverrideDict[card.details.name_lower];
        }
      }
    }

    return render(
      req,
      res,
      'CubeDeckbuilderPage',
      {
        cube,
        initialDeck: deck,
        basics: (cube.basics || DEFAULT_BASICS).map((cardID) => {
          const details = carddb.cardFromId(cardID);
          return {
            details,
            cardID: details._id,
            type_line: details.type,
            cmc: 0,
          };
        }),
        draft,
      },
      {
        title: `${abbreviate(cube.name)} - Deckbuilder`,
        metadata: generateMeta(
          `Cube Cobra Draft: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `https://cubecobra.com/cube/draft/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/decks/:cubeid/:page', async (req, res) => {
  try {
    const { cubeid } = req.params;
    const pagesize = 30;

    const page = parseInt(req.params.page, 10);

    const cube = await Cube.findOne(buildIdQuery(cubeid), Cube.LAYOUT_FIELDS).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    const decksq = Deck.find(
      {
        cube: cube._id,
      },
      '_id seats date cube',
    )
      .sort({
        date: -1,
      })
      .skip(pagesize * page)
      .limit(pagesize)
      .lean()
      .exec();
    const numDecksq = Deck.countDocuments({
      cube: cube._id,
    }).exec();

    const [numDecks, decks] = await Promise.all([numDecksq, decksq]);

    return render(
      req,
      res,
      'CubeDecksPage',
      {
        cube,
        decks,
        pages: Math.ceil(numDecks / pagesize),
        activePage: page,
      },
      {
        title: `${abbreviate(cube.name)} - Draft Decks`,
        metadata: generateMeta(
          `Cube Cobra Decks: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `https://cubecobra.com/user/decks/${encodeURIComponent(req.params.cubeid)}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.cubeid)}`);
  }
});

router.get('/decks/:id', async (req, res) => {
  res.redirect(`/cube/deck/decks/${encodeURIComponent(req.params.id)}/0`);
});

router.get('/rebuild/:id/:index', ensureAuth, async (req, res) => {
  try {
    const base = await Deck.findById(req.params.id).lean();
    if (!base) {
      req.flash('danger', 'Deck not found');
      return res.redirect('/404');
    }
    const cube = await Cube.findById(base.cube);
    const srcDraft = await Draft.findById(base.draft).lean();

    let eloOverrideDict = {};
    if (cube.useCubeElo) {
      const analytic = await CubeAnalytic.findOne({ cube: cube._id });
      eloOverrideDict = util.fromEntries(analytic.cards.map((c) => [c.cardName, c.elo]));
    }

    for (const card of base.seats[req.params.index].pickorder) {
      card.details = carddb.cardFromId(card.cardID);
      if (eloOverrideDict[card.details.name_lower]) {
        card.details.elo = eloOverrideDict[card.details.name_lower];
      }
    }

    const deck = new Deck();
    deck.cube = base.cube;
    deck.cubeOwner = base.owner;
    deck.date = Date.now();
    deck.cubename = cube.name;
    deck.draft = base.draft;
    deck.seats = [];
    deck.owner = req.user._id;

    if (srcDraft) {
      deckutil.default.init(srcDraft);
      const { colors: userColors } = await deckutil.default.buildDeck(
        base.seats[req.params.index].pickorder,
        (cube.basics || DEFAULT_BASICS).map((cardID) => {
          const details = carddb.cardFromId(cardID);
          return {
            details,
            cardID: details._id,
            type_line: details.type,
            cmc: 0,
          };
        }),
      );

      deck.seats.push({
        userid: req.user._id,
        username: `${req.user.username}: ${userColors}`,
        pickorder: base.seats[req.params.index].pickorder,
        name: `${req.user.username}'s rebuild from ${cube.name} on ${deck.date.toLocaleString('en-US')}`,
        description: 'This deck was rebuilt from another draft deck.',
        cols: base.seats[req.params.index].cols,
        deck: base.seats[req.params.index].deck,
        sideboard: base.seats[req.params.index].sideboard,
      });
      let botNumber = 1;
      for (let i = 0; i < base.seats.length; i++) {
        if (i !== parseInt(req.params.index, 10)) {
          for (const card of base.seats[i].pickorder) {
            card.details = carddb.cardFromId(card.cardID);
            if (eloOverrideDict[card.details.name_lower]) {
              card.details.elo = eloOverrideDict[card.details.name_lower];
            }
          }
          // eslint-disable-next-line no-await-in-loop
          const { deck: builtDeck, sideboard, colors } = await deckutil.default.buildDeck(
            base.seats[i].pickorder,
            (cube.basics || DEFAULT_BASICS).map((cardID) => {
              const details = carddb.cardFromId(cardID);
              return {
                details,
                cardID: details._id,
                type_line: details.type,
                cmc: 0,
              };
            }),
          );
          deck.seats.push({
            userid: null,
            username: `Bot ${botNumber}: ${colors.join(', ')}`,
            pickorder: base.seats[i].pickorder,
            name: `Draft of ${cube.name}`,
            description: `This deck was built by a bot with preference for ${colors.join(', ')}`,
            cols: base.seats[i].cols,
            deck: builtDeck,
            sideboard,
          });
          botNumber += 1;
        }
      }
    } else {
      deck.seats.push({
        userid: req.user._id,
        username: `${req.user.username}`,
        pickorder: base.seats[req.params.index].pickorder,
        name: `${req.user.username}'s rebuild from ${cube.name} on ${deck.date.toLocaleString('en-US')}`,
        description: 'This deck was rebuilt from another draft deck.',
        cols: base.seats[req.params.index].cols,
        deck: base.seats[req.params.index].deck,
        sideboard: base.seats[req.params.index].sideboard,
      });
      for (let i = 0; i < base.seats.length; i++) {
        if (i !== parseInt(req.params.index, 10)) {
          deck.seats.push({
            userid: null,
            username: base.seats[i].username,
            pickorder: base.seats[i].pickorder,
            name: `Draft of ${cube.name}`,
            description: base.seats[i].description,
            cols: base.seats[i].cols,
            deck: base.seats[i].deck,
            sideboard: base.seats[i].sideboard,
          });
        }
      }
    }

    cube.numDecks += 1;
    await addDeckCardAnalytics(cube, deck, carddb);

    const userq = User.findById(req.user._id);
    const baseuserq = User.findById(base.owner);
    const cubeOwnerq = User.findById(cube.owner);

    const [user, cubeOwner, baseUser] = await Promise.all([userq, cubeOwnerq, baseuserq]);

    if (!cubeOwner._id.equals(user._id) && !cube.disableNotifications) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} rebuilt a deck from your cube: ${cube.name}`,
      );
    }
    if (baseUser && !baseUser._id.equals(user.id)) {
      await util.addNotification(
        baseUser,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} rebuilt your deck from cube: ${cube.name}`,
      );
    }

    await Promise.all([cube.save(), deck.save()]);

    return res.redirect(`/cube/deck/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
  }
});

router.post('/editdeck/:id', ensureAuth, async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);
    const deckOwner = await User.findById(deck.seats[0].userid);

    if (!deckOwner || !deckOwner._id.equals(req.user._id)) {
      req.flash('danger', 'Unauthorized');
      return res.redirect('/404');
    }

    const cube = await Cube.findOne({ _id: deck.cube });

    await removeDeckCardAnalytics(cube, deck, carddb);

    const newdeck = JSON.parse(req.body.draftraw);
    const name = JSON.parse(req.body.name);
    const description = JSON.parse(req.body.description);

    deck.seats[0].deck = newdeck.playerdeck;
    deck.seats[0].sideboard = newdeck.playersideboard;
    deck.cols = newdeck.cols;
    deck.seats[0].name = name;
    deck.seats[0].description = description;

    await deck.save();

    await addDeckCardAnalytics(cube, deck, carddb);

    await cube.save();

    req.flash('success', 'Deck saved successfully');
    return res.redirect(`/cube/deck/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.post('/submitdeck/:id', body('skipDeckbuilder').toBoolean(), async (req, res) => {
  try {
    // req.body contains a draft
    const draftid = req.body.body;
    const draft = await Draft.findById(draftid).lean();
    const cube = await Cube.findOne(buildIdQuery(draft.cube));

    const deck = new Deck();
    deck.cube = draft.cube;
    deck.cubeOwner = cube.owner;
    deck.date = Date.now();
    deck.draft = draft._id;
    deck.cubename = cube.name;
    deck.seats = [];
    deck.owner = draft.seats[0].userid;

    for (const seat of draft.seats) {
      deck.seats.push({
        bot: seat.bot,
        userid: seat.userid,
        username: seat.name,
        pickorder: seat.pickorder,
        name: `Draft of ${cube.name}`,
        description: '',
        cols: 16,
        deck: seat.drafted,
        sideboard: seat.sideboard ? seat.sideboard : [],
      });
    }

    const userq = User.findById(deck.seats[0].userid);
    const cubeOwnerq = User.findById(cube.owner);

    const [user, cubeOwner] = await Promise.all([userq, cubeOwnerq]);

    if (user && !cube.disableNotifications) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} drafted your cube: ${cube.name}`,
      );
    }

    cube.numDecks += 1;
    await addDeckCardAnalytics(cube, deck, carddb);

    await Promise.all([cube.save(), deck.save(), cubeOwner.save()]);
    if (req.body.skipDeckbuilder) {
      return res.redirect(`/cube/deck/${deck._id}`);
    }
    return res.redirect(`/cube/deck/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
  }
});

router.post('/submitgriddeck/:id', body('skipDeckbuilder').toBoolean(), async (req, res) => {
  try {
    // req.body contains a draft
    const draftid = req.body.body;
    const draft = await GridDraft.findById(draftid).lean();
    const cube = await Cube.findOne(buildIdQuery(draft.cube));

    const deck = new Deck();
    deck.cube = draft.cube;
    deck.date = Date.now();
    deck.draft = draft._id;
    deck.cubename = cube.name;
    deck.seats = [];

    for (const seat of draft.seats) {
      deck.seats.push({
        bot: seat.bot,
        userid: seat.userid,
        username: seat.name,
        pickorder: seat.pickorder,
        name: `Grid Draft of ${cube.name}`,
        description: '',
        cols: 16,
        deck: seat.drafted,
        sideboard: seat.sideboard ? seat.sideboard : [],
      });
    }

    const userq = User.findById(deck.seats[0].userid);
    const cubeOwnerq = User.findById(cube.owner);

    const [user, cubeOwner] = await Promise.all([userq, cubeOwnerq]);

    if (user && !cube.disableNotifications) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} drafted your cube: ${cube.name}`,
      );
    }

    cube.numDecks += 1;
    await addDeckCardAnalytics(cube, deck, carddb);

    await Promise.all([cube.save(), deck.save(), cubeOwner.save()]);
    if (req.body.skipDeckbuilder) {
      return res.redirect(`/cube/deck/${deck._id}`);
    }
    return res.redirect(`/cube/deck/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
  }
});

router.get('/redraft/:id', async (req, res) => {
  try {
    const base = await Deck.findById(req.params.id).lean();

    if (!(base && base.draft)) {
      req.flash('danger', 'Deck not found');
      return res.redirect('/404');
    }

    const srcDraft = await Draft.findById(base.draft).lean();

    if (!srcDraft) {
      req.flash('danger', 'This deck is not able to be redrafted.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    const cube = await Cube.findById(srcDraft.cube);
    if (!cube) {
      req.flash('danger', 'The cube that this deck belongs to no longer exists.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    const draft = new Draft();
    draft.cube = srcDraft.cube;
    draft.seats = srcDraft.seats.slice();
    draft.basics = (cube.basics || DEFAULT_BASICS).map((cardID) => {
      const details = carddb.cardFromId(cardID);
      return {
        details,
        cardID: details._id,
        type_line: details.type,
        cmc: 0,
      };
    });

    draft.initial_state = srcDraft.initial_state.slice();
    draft.unopenedPacks = srcDraft.initial_state.slice();
    draft.seats[0].bot = null;

    for (let i = 0; i < draft.seats.length; i += 1) {
      if (!draft.seats[i].bot) {
        draft.seats[i].userid = req.user ? req.user._id : null;
        draft.seats[i].name = req.user ? req.user.username : 'Anonymous';
      }

      draft.seats[i].drafted = [];
      draft.seats[i].sideboard = [];
      draft.seats[i].pickorder = [];
      draft.seats[i].packbacklog = [];

      for (let j = 0; j < 16; j += 1) {
        draft.seats[i].drafted.push([]);
      }

      draft.seats[i].packbacklog.push(draft.unopenedPacks[i].shift());
    }

    await draft.save();
    return res.redirect(`/cube/draft/${draft._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.post('/uploaddecklist/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found.');
      return res.redirect('/404');
    }

    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }

    const cards = req.body.body.match(/[^\r\n]+/g);
    if (!cards) {
      req.flash('danger', 'No cards detected');
      return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }

    // list of cardids
    const added = [];
    for (let i = 0; i < 16; i += 1) {
      added.push([]);
    }

    for (let i = 0; i < cards.length; i += 1) {
      const item = cards[i].toLowerCase().trim();
      if (/([0-9]+x )(.*)/.test(item)) {
        const count = parseInt(item.substring(0, item.indexOf('x')), 10);
        for (let j = 0; j < count; j += 1) {
          cards.push(item.substring(item.indexOf('x') + 1));
        }
      } else {
        let selected = null;
        // does not have set info
        const normalizedName = cardutil.normalizeName(item);
        const potentialIds = carddb.getIdsFromName(normalizedName);
        if (potentialIds && potentialIds.length > 0) {
          const inCube = cube.cards.find((card) => carddb.cardFromId(card.cardID).name_lower === normalizedName);
          if (inCube) {
            selected = {
              ...inCube,
              details: carddb.cardFromId(inCube.cardID),
            };
          } else {
            const reasonableCard = carddb.getMostReasonable(normalizedName, cube.defaultPrinting);
            const reasonableId = reasonableCard ? reasonableCard._id : null;
            const selectedId = reasonableId || potentialIds[0];
            selected = {
              cardID: selectedId,
              details: carddb.cardFromId(selectedId),
            };
          }
        }
        if (selected) {
          // push into correct column.
          let column = Math.min(7, selected.cmc !== undefined ? selected.cmc : selected.details.cmc);
          if (!selected.details.type.toLowerCase().includes('creature')) {
            column += 8;
          }
          added[column].push(selected);
        }
      }
    }

    const deck = new Deck();
    deck.date = Date.now();
    deck.cubename = cube.name;
    deck.cube = cube._id;
    deck.cubeOwner = cube.owner;
    deck.owner = req.user._id;
    deck.seats = [
      {
        userid: req.user._id,
        username: req.user.username,
        pickorder: [],
        name: `${req.user.username}'s decklist upload on ${deck.date.toLocaleString('en-US')}`,
        cols: 16,
        deck: added,
        sideboard: [],
      },
    ];
    deck.draft = await createDraftForSingleDeck(deck);

    await deck.save();

    cube.numDecks += 1;
    await addDeckCardAnalytics(cube, deck, carddb);

    await cube.save();

    return res.redirect(`/cube/deck/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!req.params.id || req.params.id === 'null' || req.params.id === 'false') {
      req.flash('danger', 'Invalid deck ID.');
      return res.redirect('/404');
    }

    const deck = await Deck.findById(req.params.id).lean();

    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.redirect('/404');
    }

    const cube = await Cube.findOne(buildIdQuery(deck.cube), Cube.LAYOUT_FIELDS).lean();
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    let draft = null;
    if (deck.draft) {
      draft = await Draft.findById(deck.draft);
    }

    let drafter = 'Anonymous';

    const deckUser = await User.findById(deck.owner);

    if (deckUser) {
      drafter = deckUser.username;
    }

    let eloOverrideDict = {};
    if (cube.useCubeElo) {
      const analytic = await CubeAnalytic.findOne({ cube: cube._id });
      eloOverrideDict = util.fromEntries(analytic.cards.map((c) => [c.cardName, c.elo]));
    }

    for (const seat of deck.seats) {
      for (const collection of [seat.deck, seat.sideboard]) {
        for (const pack of collection) {
          for (const card of pack) {
            card.details = carddb.cardFromId(card.cardID);
            if (eloOverrideDict[card.details.name_lower]) {
              card.details.elo = eloOverrideDict[card.details.name_lower];
            }
          }
        }
      }
      if (seat.pickorder) {
        for (const card of seat.pickorder) {
          card.details = carddb.cardFromId(card.cardID);
          if (eloOverrideDict[card.details.name_lower]) {
            card.details.elo = eloOverrideDict[card.details.name_lower];
          }
        }
      }
    }

    return render(
      req,
      res,
      'CubeDeckPage',
      {
        cube,
        deck,
        draft,
      },
      {
        title: `${abbreviate(cube.name)} - ${drafter}'s deck`,
        metadata: generateMeta(
          `Cube Cobra Deck: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `https://cubecobra.com/cube/deck/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

module.exports = router;
