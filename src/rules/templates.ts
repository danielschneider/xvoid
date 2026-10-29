// Unit templates (data only). Player units: moveRange is max steps per turn at
// full AP. power is a flat damage bonus on player shots (enemy shots ignore it).
import { AP_PER_TURN } from './constants.ts';

export const PLAYER_TEMPLATES = [
  {
    id: 'vanguard',
    name: 'Vanguard',
    className: 'BREACHER',
    team: 'player',
    hp: 7,
    maxHp: 7,
    shield: 2,
    ap: AP_PER_TURN,
    moveRange: 6,
    power: 0,
    color: '#62e6c4',
  },
  {
    id: 'spectre',
    name: 'Spectre',
    className: 'RECON',
    team: 'player',
    hp: 4,
    maxHp: 4,
    shield: 1,
    ap: AP_PER_TURN,
    moveRange: 9,
    power: 1,
    color: '#87b5ff',
  },
  {
    id: 'medic',
    name: 'Medic',
    className: 'FIELD MEDIC',
    team: 'player',
    hp: 5,
    maxHp: 5,
    shield: 2,
    ap: AP_PER_TURN,
    moveRange: 7,
    power: -1,
    color: '#f0d77e',
  },
] as const;

export const ENEMY_TEMPLATES = [
  { role: 'raider', name: 'Void Raider', className: 'RAIDER', hp: 5, shield: 0, color: '#ff6f66' },
  { role: 'stalker', name: 'Void Stalker', className: 'STALKER', hp: 6, shield: 1, color: '#d28cff' },
  { role: 'scout', name: 'Void Scout', className: 'SCOUT', hp: 4, shield: 0, color: '#ff9b70' },
  { role: 'guard', name: 'Void Guard', className: 'GUARD', hp: 7, shield: 2, color: '#d47682' },
  // Model-based enemy classes: `model` selects the sprite body shape in sprites.js.
  { role: 'crawler', name: 'Void Crawler', className: 'CRAWLER', model: 'crawler', hp: 3, shield: 0, color: '#9dff6f' },
  { role: 'soldier', name: 'Void Soldier', className: 'SOLDIER', model: 'soldier', hp: 6, shield: 1, color: '#ffd166' },
  { role: 'monster', name: 'Void Monster', className: 'MONSTER', model: 'monster', hp: 9, shield: 2, color: '#ff4fa3' },
  { role: 'sneaker', name: 'Void Sneaker', className: 'SNEAKER', hp: 4, shield: 0, color: '#7fd6ff' },
] as const;
