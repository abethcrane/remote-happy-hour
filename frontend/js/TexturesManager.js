import { textureSpecs } from '../data/texture_specs.json';

class TexturesManager {
  GetAvatarNames() {
    return textureSpecs.filter(spec => !!spec.isAvatar).map(spec => spec.name);
  }

  GetAvatarTextureSpecs() {
    return textureSpecs.filter(spec => !!spec.isAvatar);
  }

  GetTextureSpecs() {
    return textureSpecs;
  }
};

export default TexturesManager;
