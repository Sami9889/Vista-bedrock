#!/usr/bin/env python3
"""
Vista Bedrock Addon Validator
Checks all pack files against Minecraft Bedrock Edition documentation requirements.
Run this before packaging or submitting a PR.
"""

import json
import glob
import os
import sys
import zipfile


def validate_json_files():
    """Validate all JSON files are parseable."""
    errors = []
    for f in glob.glob('vista-bedrock/**/*.json', recursive=True):
        try:
            with open(f) as fh:
                json.load(fh)
        except Exception as e:
            errors.append(f'{f}: JSON parse error: {e}')
    return errors


def validate_manifests():
    """Validate BP and RP manifests."""
    errors = []
    
    for pack_type, path in [
        ('BP', 'vista-bedrock/behavior_packs/VistaBP/manifest.json'),
        ('RP', 'vista-bedrock/resource_packs/VistaRP/manifest.json')
    ]:
        with open(path) as f:
            data = json.load(f)
        
        if data.get('format_version') != 2:
            errors.append(f'{pack_type} manifest: format_version should be 2')
        if not data.get('header', {}).get('name'):
            errors.append(f'{pack_type} manifest: missing header.name')
        if not data.get('header', {}).get('uuid'):
            errors.append(f'{pack_type} manifest: missing header.uuid')
        if not data.get('header', {}).get('version'):
            errors.append(f'{pack_type} manifest: missing header.version')
    
    return errors


def validate_items():
    """Validate all item definitions."""
    errors = []
    
    for f in sorted(glob.glob('vista-bedrock/behavior_packs/VistaBP/items/*.json')):
        with open(f) as fh:
            data = json.load(fh)
        
        item = data.get('minecraft:item', {})
        desc = item.get('description', {})
        components = item.get('components', {})
        
        identifier = desc.get('identifier', '')
        if not identifier:
            errors.append(f'{f}: missing identifier')
        if 'minecraft:icon' not in components:
            errors.append(f'{f}: missing minecraft:icon')
        if 'minecraft:display_name' not in components:
            errors.append(f'{f}: missing minecraft:display_name')
        if 'menu_category' not in desc:
            errors.append(f'{f}: missing menu_category')
        else:
            mc = desc['menu_category']
            if 'category' not in mc:
                errors.append(f'{f}: menu_category missing category')
            if 'group' not in mc:
                errors.append(f'{f}: menu_category missing group')
    
    return errors


def validate_blocks():
    """Validate all block definitions."""
    errors = []
    
    for f in sorted(glob.glob('vista-bedrock/behavior_packs/VistaBP/blocks/*.json')):
        with open(f) as fh:
            data = json.load(fh)
        
        block = data.get('minecraft:block', {})
        desc = block.get('description', {})
        components = block.get('components', {})
        
        identifier = desc.get('identifier', '')
        if not identifier:
            errors.append(f'{f}: missing identifier')
        if 'minecraft:geometry' not in components:
            errors.append(f'{f}: missing minecraft:geometry')
        if 'minecraft:display_name' not in components:
            errors.append(f'{f}: missing minecraft:display_name')
        
        for state_name in desc.get('states', {}):
            if ':' in state_name:
                errors.append(f'{f}: State {state_name} should not have namespace prefix')
        
        deprecated = {'minecraft:on_player_placing', 'minecraft:on_player_destroyed'}
        for comp in deprecated:
            if comp in components:
                errors.append(f'{f}: Deprecated component {comp}')
        
        if 'minecraft:light_emission' in components:
            le = components['minecraft:light_emission']
            if isinstance(le, dict):
                errors.append(f'{f}: light_emission should be numeric, not object')
    
    return errors


def validate_recipes():
    """Validate all recipe definitions."""
    errors = []
    
    for f in sorted(glob.glob('vista-bedrock/behavior_packs/VistaBP/recipes/*.json')):
        with open(f) as fh:
            data = json.load(fh)
        
        recipe = data.get('minecraft:recipe_shaped', 
                         data.get('minecraft:recipe_shapeless', {}))
        desc = recipe.get('description', {})
        
        if 'identifier' not in desc:
            errors.append(f'{f}: missing identifier')
        if 'version' not in desc:
            errors.append(f'{f}: missing version')
        if 'show_notification' not in desc:
            errors.append(f'{f}: missing show_notification')
    
    return errors


def validate_animations():
    """Validate all animation files."""
    errors = []
    
    for f in sorted(glob.glob('vista-bedrock/behavior_packs/VistaBP/animations/*.json')):
        with open(f) as fh:
            data = json.load(fh)
        
        for anim_name, anim in data.get('animations', {}).items():
            for bone_name, bone in anim.get('bones', {}).items():
                for channel in ['rotation', 'position', 'scale']:
                    if channel in bone:
                        val = bone[channel]
                        if isinstance(val, list):
                            errors.append(
                                f'{f}: {anim_name}.{bone_name}.{channel} is list, should be object'
                            )
                        elif isinstance(val, dict):
                            for k, v in val.items():
                                try:
                                    float(k)
                                except ValueError:
                                    errors.append(
                                        f'{f}: Invalid time key {k} in {anim_name}.{bone_name}.{channel}'
                                    )
    
    return errors


def validate_textures():
    """Validate all referenced textures exist."""
    errors = []
    
    for atlas_path in [
        'vista-bedrock/resource_packs/VistaRP/textures/item_texture.json',
        'vista-bedrock/resource_packs/VistaRP/textures/terrain_texture.json'
    ]:
        with open(atlas_path) as f:
            atlas = json.load(f)
        
        for name, entry in atlas.get('texture_data', {}).items():
            tex_path = entry.get('textures', '')
            if tex_path:
                full_path = f'vista-bedrock/resource_packs/VistaRP/{tex_path}.png'
                if not os.path.exists(full_path):
                    errors.append(f'Texture missing: {name} -> {full_path}')
    
    return errors


def validate_mcaddon():
    """Validate the mcaddon package."""
    errors = []
    
    if not os.path.exists('vista.mcaddon'):
        errors.append('vista.mcaddon not found')
        return errors
    
    try:
        with zipfile.ZipFile('vista.mcaddon', 'r') as zf:
            files = zf.namelist()
            
            # Check root structure
            roots = set()
            for f in files:
                parts = f.split('/')
                if len(parts) > 0:
                    roots.add(parts[0])
            
            if 'behavior_packs' not in roots:
                errors.append('Missing behavior_packs/ in mcaddon')
            if 'resource_packs' not in roots:
                errors.append('Missing resource_packs/ in mcaddon')
            
            # Check for manifests
            manifests = [f for f in files if 'manifest.json' in f]
            if len(manifests) != 2:
                errors.append(f'Expected 2 manifests, found {len(manifests)}')
    except Exception as e:
        errors.append(f'mcaddon validation error: {e}')
    
    return errors


def main():
    """Run all validations."""
    print("="*60)
    print("Vista Bedrock Addon Validator")
    print("Checking against Minecraft Bedrock Edition docs...")
    print("="*60 + "\n")
    
    all_errors = []
    
    checks = [
        ('JSON files', validate_json_files),
        ('Manifests', validate_manifests),
        ('Items', validate_items),
        ('Blocks', validate_blocks),
        ('Recipes', validate_recipes),
        ('Animations', validate_animations),
        ('Textures', validate_textures),
        ('mcaddon package', validate_mcaddon),
    ]
    
    for name, check_func in checks:
        errors = check_func()
        all_errors.extend(errors)
        status = '✅' if not errors else '❌'
        print(f"{status} {name}: {len(errors)} errors")
    
    print("\n" + "="*60)
    if all_errors:
        print(f"FAILED: {len(all_errors)} errors found")
        print("\nFirst 20 errors:")
        for e in all_errors[:20]:
            print(f"  ❌ {e}")
        sys.exit(1)
    else:
        print("SUCCESS: All checks passed!")
        print("\nYour pack is valid and ready for:")
        print("  - GitHub Actions CI/CD")
        print("  - GitHub Pages deployment")
        print("  - Script debugger testing")
        print("  - Import into Minecraft Bedrock")
        sys.exit(0)


if __name__ == '__main__':
    main()
