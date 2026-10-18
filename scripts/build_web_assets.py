"""
Build Web-Optimized 3D GLB Models and PBR Textures for project_isr 3d web
-------------------------------------------------------------------------
Processes raw GLB files from D:/PROJECTS/IGI Remake/Godot_Export and textures
from D:/PROJECTS/IGI Remake/Project Files, compressing embedded PNGs into
size-clamped WebP images and filtering redundant meshes so that the entire
3D asset library loads rapidly in Three.js WebGL.
"""

import os
import struct
import json
import io
import hashlib
from PIL import Image

SOURCE_GODOT_DIR = r"D:\PROJECTS\IGI Remake\Godot_Export"
SOURCE_TEX_DIR = r"D:\PROJECTS\IGI Remake\Project Files"
PUBLIC_MODELS_DIR = r"D:\PROJECTS\project_isr 3d web\public\assets\models"
PUBLIC_TEX_DIR = r"D:\PROJECTS\project_isr 3d web\public\assets\textures"

os.makedirs(PUBLIC_MODELS_DIR, exist_ok=True)
os.makedirs(PUBLIC_TEX_DIR, exist_ok=True)

# Target GLB asset configurations:
# (output_name, relative_source_path, max_tex_dim, quality_color, quality_normal, keep_mesh_indices)
GLB_TARGETS = [
    ("watch_tower.glb", "Buildings/Watch_Tower.glb", 1024, 85, 92, None),
    ("guard_tower.glb", "Buildings/Guard_Tower.glb", 1024, 85, 92, None),
    ("shipping_container.glb", "Buildings/Shipping_Container.glb", 1024, 85, 92, None),
    ("concrete_fences.glb", "Buildings/Concrete_Fences.glb", 512, 85, 90, None),
    ("big_building.glb", "Buildings/BigBuilding.glb", 1024, 85, 90, None),
    ("military_outpost.glb", "Buildings/Military_Outpost.glb", 512, 82, 88, None),
    ("barrels.glb", "Props/Barrels.glb", 512, 85, 90, None),
    ("cardboard_boxes.glb", "Props/Cardboard_Boxes.glb", 512, 85, 90, None),
    ("military_crates.glb", "Props/Military_Crates.glb", 512, 85, 90, None),
    ("military_truck.glb", "Vehicles/Military_Truck_M923.glb", 1024, 85, 90, [0]),
    ("blackhawk_heli.glb", "Vehicles/UH60A_BlackHawk.glb", 1024, 85, 90, [0]),
    ("assault_rifle.glb", "Weapons_and_Items/Assault_Rifle_Pickup.glb", 512, 88, 92, None),
    ("first_aid_box.glb", "Weapons_and_Items/FirstAidBox.glb", 512, 88, 92, None),
    ("pine_trees.glb", "Foliage_Templates/Pine_Trees.glb", 512, 85, 90, None),
    ("dead_trees.glb", "Foliage_Templates/Dead_Trees.glb", 512, 85, 90, None),
    ("rocks.glb", "Foliage_Templates/Rocks.glb", 512, 85, 90, None),
    ("background_mountains.glb", "Foliage_Templates/Background_Mountains.glb", 1024, 82, 88, None),
]

# Standalone PBR Textures to optimize into public/assets/textures/
TEXTURE_TARGETS = [
    ("concrete_wall_diff.webp", "wall_stucco_03.png", 1024, 85),
    ("concrete_wall_rough.webp", "WarehouseMainConcrete_MetallicRoughness.png", 1024, 85),
    ("walkway_diff.webp", "Walkway_Diffuse.png", 1024, 85),
    ("walkway_norm.webp", "Walkway_Normal.png", 1024, 90),
    ("walkway_rough.webp", "Walkway_MetallicRoughness.png", 1024, 85),
    ("trim_diff.webp", "Trim_Sheet_BaseColor.png", 1024, 85),
    ("trim_norm.webp", "Trim_sheet_Normal_OpenGL.png", 1024, 90),
    ("trim_rough.webp", "Trim_Sheet_MetallicRoughness.png", 1024, 85),
    ("wood_plank_diff.webp", "wood_plank6.png", 1024, 85),
    ("watchtower_diff.webp", "watchtower_Base_Color.png", 1024, 85),
    ("watchtower_norm.webp", "watchtower_Normal_OpenGL.png", 1024, 90),
]


def compress_glb_asset(out_name, rel_source, max_dim, q_color, q_norm, keep_meshes):
    in_path = os.path.join(SOURCE_GODOT_DIR, rel_source.replace("/", os.sep))
    out_path = os.path.join(PUBLIC_MODELS_DIR, out_name)

    if not os.path.exists(in_path):
        print(f"[WARN] Source not found: {in_path}")
        return 0, 0

    orig_size = os.path.getsize(in_path)
    with open(in_path, "rb") as f:
        magic, version, length = struct.unpack("<4sII", f.read(12))
        if magic != b"glTF":
            raise ValueError(f"Invalid GLB header in {in_path}")

        chunk_len, chunk_type = struct.unpack("<I4s", f.read(8))
        gltf = json.loads(f.read(chunk_len).decode("utf-8"))

        bin_chunk_len, bin_chunk_type = struct.unpack("<I4s", f.read(8))
        bin_start = 12 + 8 + chunk_len + 8

        # Optional mesh filtering (e.g., stripping duplicate/damaged vehicle meshes)
        if keep_meshes is not None and "meshes" in gltf and "nodes" in gltf:
            keep_set = set(keep_meshes)
            for node in gltf["nodes"]:
                if "mesh" in node and node["mesh"] not in keep_set:
                    del node["mesh"]

        images = gltf.get("images", [])
        buffer_views = gltf.get("bufferViews", [])
        materials = gltf.get("materials", [])
        textures = gltf.get("textures", [])

        # Identify which accessors and bufferViews are actually referenced by active meshes
        active_bv_indices = set()
        accessors = gltf.get("accessors", [])

        # Check which meshes are referenced by nodes
        referenced_meshes = set()
        for n in gltf.get("nodes", []):
            if "mesh" in n:
                referenced_meshes.add(n["mesh"])
        if not referenced_meshes and "meshes" in gltf:
            referenced_meshes = set(range(len(gltf["meshes"])))

        active_materials = set()
        for m_idx in referenced_meshes:
            if m_idx < len(gltf.get("meshes", [])):
                mesh = gltf["meshes"][m_idx]
                for prim in mesh.get("primitives", []):
                    if "indices" in prim:
                        acc = accessors[prim["indices"]]
                        if "bufferView" in acc:
                            active_bv_indices.add(acc["bufferView"])
                    for attr_acc_idx in prim.get("attributes", {}).values():
                        acc = accessors[attr_acc_idx]
                        if "bufferView" in acc:
                            active_bv_indices.add(acc["bufferView"])
                    if "material" in prim:
                        active_materials.add(prim["material"])

        # Also keep any other non-image bufferViews if referenced by skins/animations
        image_bv_indices = set()
        for img in images:
            if "bufferView" in img:
                image_bv_indices.add(img["bufferView"])

        # Identify normal map images and active images
        normal_image_indices = set()
        active_image_indices = set()
        for mat_idx, mat in enumerate(materials):
            if active_materials and mat_idx not in active_materials:
                continue
            pbr = mat.get("pbrMetallicRoughness", {})
            for tex_key in ("baseColorTexture", "metallicRoughnessTexture"):
                if tex_key in pbr:
                    t_idx = pbr[tex_key].get("index")
                    if t_idx is not None and t_idx < len(textures):
                        src = textures[t_idx].get("source")
                        if src is not None:
                            active_image_indices.add(src)
            for tex_key in ("normalTexture", "occlusionTexture", "emissiveTexture"):
                if tex_key in mat:
                    t_idx = mat[tex_key].get("index")
                    if t_idx is not None and t_idx < len(textures):
                        src = textures[t_idx].get("source")
                        if src is not None:
                            active_image_indices.add(src)
                            if tex_key == "normalTexture":
                                normal_image_indices.add(src)

        if not active_image_indices:
            active_image_indices = set(range(len(images)))

        new_bin = bytearray()
        new_buffer_views = []
        bv_remap = {}

        # Copy non-image buffer views
        for old_bv_idx, bv in enumerate(buffer_views):
            if old_bv_idx not in image_bv_indices:
                if active_bv_indices and old_bv_idx not in active_bv_indices:
                    # Create a tiny dummy 4-byte bufferView for unreferenced geometry
                    new_bv_idx = len(new_buffer_views)
                    new_buffer_views.append({
                        "buffer": 0,
                        "byteOffset": 0,
                        "byteLength": 4,
                    })
                    bv_remap[old_bv_idx] = new_bv_idx
                    continue

                f.seek(bin_start + bv.get("byteOffset", 0))
                raw_data = f.read(bv["byteLength"])

                align_pad = (4 - (len(new_bin) % 4)) % 4
                new_bin.extend(b"\x00" * align_pad)

                new_offset = len(new_bin)
                new_bv = dict(bv)
                new_bv["byteOffset"] = new_offset
                new_bv["byteLength"] = len(raw_data)

                new_bv_idx = len(new_buffer_views)
                new_buffer_views.append(new_bv)
                bv_remap[old_bv_idx] = new_bv_idx
                new_bin.extend(raw_data)

        for acc in accessors:
            if "bufferView" in acc and acc["bufferView"] in bv_remap:
                acc["bufferView"] = bv_remap[acc["bufferView"]]

        # Compress and deduplicate images
        image_hash_map = {}
        processed_images = []
        dummy_1x1_webp = None

        for idx, img in enumerate(images):
            if "bufferView" not in img:
                processed_images.append(img)
                continue

            if idx not in active_image_indices:
                # Replace unused material image with 1x1 placeholder
                if dummy_1x1_webp is None:
                    im_dummy = Image.new("RGB", (4, 4), (128, 128, 128))
                    b_io = io.BytesIO()
                    im_dummy.save(b_io, format="WEBP", quality=50)
                    dummy_bytes = b_io.getvalue()
                    align_pad = (4 - (len(new_bin) % 4)) % 4
                    new_bin.extend(b"\x00" * align_pad)
                    dummy_bv_idx = len(new_buffer_views)
                    new_buffer_views.append({
                        "buffer": 0,
                        "byteOffset": len(new_bin),
                        "byteLength": len(dummy_bytes),
                    })
                    new_bin.extend(dummy_bytes)
                    dummy_1x1_webp = dummy_bv_idx

                new_img = dict(img)
                new_img["bufferView"] = dummy_1x1_webp
                new_img["mimeType"] = "image/webp"
                processed_images.append(new_img)
                continue

            old_bv = buffer_views[img["bufferView"]]
            f.seek(bin_start + old_bv.get("byteOffset", 0))
            raw_img_data = f.read(old_bv["byteLength"])

            img_hash = hashlib.sha256(raw_img_data).hexdigest()
            if img_hash in image_hash_map:
                new_img = dict(img)
                new_img["bufferView"] = image_hash_map[img_hash]["bufferView"]
                new_img["mimeType"] = image_hash_map[img_hash]["mimeType"]
                processed_images.append(new_img)
                continue

            is_normal = idx in normal_image_indices
            try:
                with Image.open(io.BytesIO(raw_img_data)) as im:
                    w, h = im.size
                    if w > max_dim or h > max_dim:
                        scale = min(max_dim / w, max_dim / h)
                        nw = max(4, int(w * scale))
                        nh = max(4, int(h * scale))
                        im = im.resize((nw, nh), Image.Resampling.LANCZOS)

                    if im.mode not in ("RGB", "RGBA"):
                        im = im.convert("RGBA")

                    out_io = io.BytesIO()
                    im.save(
                        out_io,
                        format="WEBP",
                        quality=q_norm if is_normal else q_color,
                        method=4,
                    )
                    compressed_bytes = out_io.getvalue()
                    mime_type = "image/webp"
            except Exception:
                compressed_bytes = raw_img_data
                mime_type = img.get("mimeType", "image/png")

            align_pad = (4 - (len(new_bin) % 4)) % 4
            new_bin.extend(b"\x00" * align_pad)

            new_offset = len(new_bin)
            new_bv_idx = len(new_buffer_views)
            new_buffer_views.append({
                "buffer": 0,
                "byteOffset": new_offset,
                "byteLength": len(compressed_bytes),
            })
            new_bin.extend(compressed_bytes)

            image_hash_map[img_hash] = {
                "bufferView": new_bv_idx,
                "mimeType": mime_type,
            }

            new_img = dict(img)
            new_img["bufferView"] = new_bv_idx
            new_img["mimeType"] = mime_type
            processed_images.append(new_img)

        gltf["images"] = processed_images
        gltf["bufferViews"] = new_buffer_views
        gltf["buffers"] = [{"byteLength": len(new_bin)}]

        new_json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
        json_pad = (4 - (len(new_json_bytes) % 4)) % 4
        new_json_bytes += b" " * json_pad

        bin_pad = (4 - (len(new_bin) % 4)) % 4
        new_bin.extend(b"\x00" * bin_pad)

        total_glb_len = 12 + 8 + len(new_json_bytes) + 8 + len(new_bin)
        with open(out_path, "wb") as out_f:
            out_f.write(struct.pack("<4sII", b"glTF", 2, total_glb_len))
            out_f.write(struct.pack("<I4s", len(new_json_bytes), b"JSON"))
            out_f.write(new_json_bytes)
            out_f.write(struct.pack("<I4s", len(new_bin), b"BIN\x00"))
            out_f.write(new_bin)

    final_size = os.path.getsize(out_path)
    print(
        f"[OK] {out_name:26s}: {orig_size/(1024*1024):6.2f} MB -> {final_size/(1024*1024):5.2f} MB "
        f"({((orig_size - final_size)/orig_size)*100:4.1f}% saved)"
    )
    return orig_size, final_size


def compress_standalone_textures():
    print("\n[INFO] Processing standalone PBR textures...")
    for out_name, src_name, max_dim, quality in TEXTURE_TARGETS:
        in_path = os.path.join(SOURCE_TEX_DIR, src_name)
        out_path = os.path.join(PUBLIC_TEX_DIR, out_name)
        if not os.path.exists(in_path):
            print(f"[WARN] Texture not found: {in_path}")
            continue
        orig_sz = os.path.getsize(in_path)
        with Image.open(in_path) as im:
            w, h = im.size
            if w > max_dim or h > max_dim:
                scale = min(max_dim / w, max_dim / h)
                im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGB")
            im.save(out_path, format="WEBP", quality=quality, method=4)
        new_sz = os.path.getsize(out_path)
        print(f"[OK] {out_name:26s}: {orig_sz/1024:7.1f} KB -> {new_sz/1024:6.1f} KB")


def main():
    print("[INFO] Starting 3D Web Asset Compression Pipeline...")
    total_orig = 0
    total_final = 0
    for out_name, rel_src, max_dim, qc, qn, keep_m in GLB_TARGETS:
        o, f = compress_glb_asset(out_name, rel_src, max_dim, qc, qn, keep_m)
        total_orig += o
        total_final += f

    compress_standalone_textures()
    print("-" * 68)
    print(
        f"[SUCCESS] Total 3D Models: {total_orig/(1024*1024):.2f} MB -> {total_final/(1024*1024):.2f} MB "
        f"({((total_orig - total_final)/max(1, total_orig))*100:.1f}% reduction)"
    )


if __name__ == "__main__":
    main()
