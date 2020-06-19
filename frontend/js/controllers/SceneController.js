import { cloneDeep, find, findIndex, groupBy } from 'lodash';
import moment from 'moment';

class SceneController {
  constructor(colliders, textureSpecs, players) {
    this._textureSpecs = cloneDeep(textureSpecs);
    this.setPlayers(players);
    this.setLayout(colliders);

    this.moveCharacter = this.moveCharacter.bind(this);
    this.getRenderModels = this.getRenderModels.bind(this);
    this.getTextureSpecs = this.getTextureSpecs.bind(this);
  }

  setPlayers(players) {
    this._players = cloneDeep(players);
  }

  setLayout(colliders) {
    this._colliders = cloneDeep(colliders);

    const texAndSubtexExist = (texture, subtexture) => {
      const spec = find(this._textureSpecs, (spec) => spec.name === texture);
      return !!(spec && spec.tiles[subtexture]);
    };
    const missing = this._colliders.filter(
      (model) => !texAndSubtexExist(model.texture, model.subtexture)
    );
    if (missing.length) {
      const model = missing[0];
      throw Error(
        `Collider referencing nonexisting texture ${model.texture}, ${model.subtexture}`
      );
    }
  }

  hasPlayerId(playerId) {
    return this.getPlayerIndex(playerId) !== -1;
  }

  getPlayerById(playerId) {
    const index = this.getPlayerIndex(playerId);
    if (index === -1) {
      throw Error('Current player is not in the list of players');
    }
    return this._players[index];
  }

  getPlayerIndex(playerId) {
    return findIndex(this._players, (player) => player.id === playerId);
  }

  getPlayerPositions(time) {
    time = time === undefined ? moment() : time;
    return this._players.map((player) => ({
      id: player.id,
      x: player.lastPosition.x,
      y: player.lastPosition.y,
    }));
  }

  getRenderModels(time) {
    time = time === undefined ? moment() : time;
    return [].concat(
      this._colliders.map((collider) => colliderToRenderModel(collider, time)),
      this._players.map((player) => playerToRenderModel(player, time))
    );
  }

  getTextureSpecs() {
    return this._textureSpecs;
  }

  moveCharacter(direction, playerId, onUpdate) {
    // TODO: Do some error checking, then sync state w/ server
    const currentIndex = this.getPlayerIndex(playerId);
    const current = this._players[currentIndex];

    let lastAction = null;
    let lastPosition = current.lastPosition;

    const dirToDelta = {
      right: { x: 1 },
      left: { x: -1 },
      up: { y: 1 },
      down: { y: -1 },
    };

    const dirToAction = {
      right: 'look_right',
      left: 'look_left',
      up: 'look_up',
      down: 'look_down',
    };

    if (dirToDelta[direction] === undefined) {
      throw Error('Unrecognized direction');
    }

    const delta = dirToDelta[direction];
    const targetPosition = { ...current.lastPosition };
    targetPosition.x += delta.x || 0;
    targetPosition.y += delta.y || 0;

    const next = this.acceptMove(current.lastPosition, targetPosition)
      ? {
          ...current,
          lastAction: dirToAction[direction],
          lastPosition: targetPosition,
        }
      : {
          ...current,
          lastAction: dirToAction[direction],
        };

    this._players[currentIndex] = next;
    if (onUpdate) {
      onUpdate(next);
    }
  }

  acceptMove(currentPosition, nextPosition) {
    const groups = groupBy(this._colliders, (rect) => rect.category);
    return (
      groups.ground.some((rect) => pointInRect(nextPosition, rect)) &&
      !this.isWall(groups.wall, nextPosition) &&
      !this._players.some((player) =>
        pointInPoint(nextPosition, player.lastPosition)
      )
    );
  }

  isWall(walls, pos) {
    return (
      walls && walls.length && walls.some((rect) => pointInRect(pos, rect))
    );
  }
}

const playerToRenderModel = (player, time) => {
  const { displayName, iconName, lastPosition } = player;
  return {
    x: lastPosition.x,
    y: lastPosition.y,
    w: 1,
    h: 1,
    texture: iconName,
    subtexture: playerToSubtexture(player, time),
    text: displayName,
  };
};

const playerToSubtexture = (player, time) => {
  const actionToSubtexture = {
    look_left: 'standing_left',
    look_right: 'standing_right',
    look_down: 'standing_fwd',
    look_up: 'standing_back',
  };

  return actionToSubtexture[player.lastAction] || 'standing_fwd';
};

const colliderToRenderModel = (collider, time) => {
  const { position, size, ...rest } = collider;
  return {
    ...position,
    ...size,
    ...rest,
  };
};

const pointInRect = (pt, rect) =>
  pt.x >= rect.position.x &&
  pt.x < rect.position.x + rect.size.w &&
  pt.y >= rect.position.y &&
  pt.y < rect.position.y + rect.size.h;

const pointInPoint = (pt1, pt2) => pt1.x === pt2.x && pt1.y === pt2.y;

export default SceneController;
