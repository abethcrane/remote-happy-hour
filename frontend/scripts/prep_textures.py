#!/usr/bin/env python3
"""
General python script for all texture pre-processing we need to do.
This shouldn't be run directly; rather, run ./frontend/scripts/prep_textures
"""

from argparse import ArgumentParser
from glob import glob
from itertools import product
import json
import os
import re
import subprocess
import shutil
import sys
import yaml


def main(argv):
    args = _parse_arguments(argv)
    texture_paths = get_texture_paths(args.assets_root)

    if args.clean and os.path.exists(args.output_dir):
        shutil.rmtree(args.output_dir)
    os.makedirs(args.output_dir)

    default_config = _load_yaml_to_dict(
        os.path.join(args.assets_root, args.default_config_file)
    )

    texture_specs = [
        compile_texture_directory(
            path, args.output_dir, default_config, args.config_file
        )
        for path in texture_paths
    ]

    spec_path = _ensure_ends_with(args.output_spec_file, '.json')
    with open(spec_path, 'w') as f:
        json.dump(dict(textureSpecs=texture_specs), f, indent=2, sort_keys=True)
    print('Wrote:', spec_path)


def get_texture_paths(root):
    paths = sorted(os.path.join(root, path) for path in os.listdir(root))
    return list(filter(os.path.isdir, paths))


def compile_texture_directory(path, output_dir, default_config, config_file):
    name = os.path.basename(path)
    print('Compiling', name)

    # Create config with optional overrides
    config = dict(default_config)
    config.update(**_load_yaml_to_dict(os.path.join(path, config_file)))

    input_subtextures = sorted(glob(os.path.join(path, '*.png')))
    output_montage_path = os.path.join(output_dir, name + '.png')
    if not input_subtextures:
        print('Error: found no viable subtextures. Skipping.')
        return None

    strip_name = r'^{}_?'.format(name)
    tile_data = _montage_images(
        input_subtextures,
        output_montage_path,
        config['montage_size'],
        config['num_cols'],
        strip_name if config['strip_name_from_subtexture'] else None,
    )

    # Validate required subtextures
    missing_textures = set(config.get('required_tiles', [])) - set(tile_data['tiles'])
    if missing_textures:
        raise RuntimeError(
            'Error: missing required subtextures: ' + ' '.join(missing_textures)
        )

    return dict(
        name=name,
        path=output_montage_path,
        isAvatar=bool(config.get('is_avatar', False)),
        **tile_data,
    )


def _montage_images(input_paths, output_path, size_setting, num_cols, strip_prefix):
    # For now, let's use a basic grid
    num_cols = int(num_cols)
    num_rows = (len(input_paths) + num_cols - 1) // num_cols

    # Build args
    tile_arg = f'{num_cols}x{num_rows}'
    geom_arg = f'{size_setting}+0+0'

    subprocess.check_call(
        [
            'montage',
            '-background',
            'transparent',
            '-geometry',
            geom_arg,
            '-tile',
            tile_arg,
        ]
        + input_paths
        + [output_path]
    )

    def _tile_name(path):
        name = os.path.basename(path).rsplit('.', 1)[0]
        if strip_prefix:
            return re.sub(strip_prefix, '', name)
        return name

    tiles = dict(
        [
            (_tile_name(path), loc)
            for path, loc in zip(input_paths, product(range(num_rows), range(num_cols)))
        ]
    )

    return dict(layout=[num_rows, num_cols], tiles=tiles,)


def _load_yaml_to_dict(path):
    if os.path.isfile(path):
        with open(path) as f:
            data = yaml.safe_load(f)
        if not isinstance(data, dict):
            raise TypeError(
                'Expected config file {} to be yaml of shape dict'.format(path)
            )
        return data
    return {}


def _ensure_ends_with(string, ending):
    return string if string.endswith(ending) else (string + ending)


def _parse_arguments(argv):
    parser = ArgumentParser()

    parser.add_argument('assets_root')
    parser.add_argument('output_dir')
    parser.add_argument('output_spec_file')
    parser.add_argument(
        '--clean',
        action='store_true',
        help='Remove all files from the output directory first',
    )
    parser.add_argument('--default-config-file', default='default_config.yml')
    parser.add_argument('--config-file', default='config.yml')

    return parser.parse_args(argv[1:])


if __name__ == '__main__':
    main(sys.argv)
