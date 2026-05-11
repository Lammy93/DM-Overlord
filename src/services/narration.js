import config from '../config.js';

const STYLES = {
  descriptive: {
    encounter_start: [
      'A tense silence falls over the area as you sense danger nearby...',
      'The air grows thick with anticipation. Something stirs in the shadows...',
      'You hear the subtle crunch of gravel beneath heavy footsteps. You are not alone.',
    ],
    hit: [
      'Your blade finds its mark!',
      'A solid hit! The attack connects with satisfying force.',
      'You strike true, landing a devastating blow!',
    ],
    miss: [
      'Your attack just barely misses its target.',
      'The creature dodges at the last possible moment.',
      'Your weapon whistles through empty air.',
    ],
    kill: [
      'With a final, decisive blow, the creature falls!',
      'The enemy collapses, defeated at last.',
      'A mighty roar echoes as your foe is vanquished!',
    ],
    crit: [
      'A perfect strike! Critical hit!',
      'You find the exact weak point and exploit it perfectly!',
      'Fortune favors you as you land an extraordinary blow!',
    ],
    level_up: [
      'A surge of power flows through you. You have grown stronger!',
      'Experience crystallizes into new strength. You level up!',
      'Your trials have made you mightier. New abilities awaken within!',
    ],
  },
  cinematic: {
    encounter_start: [
      'The world narrows to the space between heartbeats. Then — motion in the dark.',
      'A low growl rumbles from the treeline. Whatever it is, it has found you.',
      'Dust motes dance in the torchlight as the ground trembles. Roll for initiative.',
    ],
    hit: [
      'Steel meets flesh in a shower of sparks and fury!',
      'The impact resonates through the air like a thunderclap!',
      'A precise strike that would make the legends weep with envy!',
    ],
    miss: [
      'The attack carves nothing but air — a whisper of what might have been.',
      'Your foe twists aside with unnatural grace, your strike wasted.',
      'Close enough to feel the wind of its passage, but not close enough.',
    ],
    kill: [
      'Time seems to slow as your final blow lands. The creature crumbles.',
      'A thunderous crash marks the end of this foe. Victory is yours!',
      'The light fades from its eyes as it falls. One fewer enemy in the world.',
    ],
    crit: [
      'By the gods! A blow of legendary proportion!',
      'The stars align and your strike lands with devastating precision!',
      'A masterful stroke — one that bards will sing of for years to come!',
    ],
    level_up: [
      'A radiant energy courses through your veins. You have transcended your limits!',
      'The universe whispers new secrets into your soul. You ascend in power!',
      'Like a phoenix rising, you shed your former self and emerge greater!',
    ],
  },
  minimal: {
    encounter_start: ['Enemy spotted! Roll initiative.', 'Combat begins!', 'Danger approaches!'],
    hit: ['Hit!', 'Attack lands.', 'Damage dealt.'],
    miss: ['Miss.', 'Attack fails.', 'No hit.'],
    kill: ['Enemy defeated!', 'Target eliminated.', 'Victory!'],
    crit: ['Critical hit!', 'CRIT!'],
    level_up: ['Level up!', 'You gained a level!'],
  },
  humorous: {
    encounter_start: [
      'Oh look, something wants to ruin your day!',
      'The monster clearly didn\'t get the memo that you\'re the main characters.',
      'Time for some \'aggressive negotiations\'!',
    ],
    hit: [
      'Boop! Right in the face!',
      'The target has been... aggressively befriended.',
      'That\'s gonna leave a mark. A big one.',
    ],
    miss: [
      'You swing so hard you almost fall over. Almost.',
      'The monster looks at you with mild disappointment.',
      'That was so close you could smell what it had for lunch.',
    ],
    kill: [
      'And stay down!',
      'One down, and they\'re not getting back up.',
      'Send this one to the great respawn point in the sky.',
    ],
    crit: [
      'NATURAL 20! The dice gods smile upon you!',
      'CRITICAL! Go buy a lottery ticket after this!',
      'That was so perfect it should be in a museum!',
    ],
    level_up: [
      'Congratulations! You\'ve unlocked: Being More Awesome!',
      'Level up! Your character sheet just got upgrades!',
      'Ding! You are now slightly more capable of heroic shenanigans!',
    ],
  },
};

export function getNarration(moment, customStyle = null) {
  const style = customStyle || config.narration.style || 'descriptive';
  const styleData = STYLES[style] || STYLES.descriptive;
  const lines = styleData[moment];
  if (!lines || lines.length === 0) return '';
  return lines[Math.floor(Math.random() * lines.length)];
}

export function generateEncounterDescription(monster, count = 1) {
  if (!monster) return 'A threat approaches!';

  const size = monster.size || 'medium';
  const type = monster.type || 'creature';
  const name = count > 1 ? `${monster.name} (x${count})` : monster.name;

  const sizeDesc = {
    tiny: 'barely visible',
    small: 'knee-high',
    medium: 'man-sized',
    large: 'massive',
    huge: 'enormous',
    gargantuan: 'colossal',
  };

  const desc = [
    `A${['aeiou'].includes(sizeDesc[size]?.[0]) ? 'n' : ''} ${sizeDesc[size] || ''} ${type} stands before you — ${name}!`,
    `${count > 1 ? `${count} ` : ''}${name} emerge${count === 1 ? 's' : ''} from the shadows, ready for battle!`,
    `You face ${count === 1 ? 'a' : count} ${name}! Prepare for combat!`,
  ];

  return desc[Math.floor(Math.random() * desc.length)];
}
