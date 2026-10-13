import os
from PIL import Image, ImageDraw, ImageFont

def create_tg_xray_icon(size=512):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Outer circle (Telegram Blue gradient-like tone #2AABEE)
    circle_color = (42, 171, 238, 255)
    margin = int(size * 0.04)
    draw.ellipse([margin, margin, size - margin, size - margin], fill=circle_color)
    
    # Paper airplane in center (White)
    p1 = (int(size * 0.22), int(size * 0.50))
    p2 = (int(size * 0.78), int(size * 0.26))
    p3 = (int(size * 0.62), int(size * 0.76))
    p4 = (int(size * 0.48), int(size * 0.60))
    p5 = (int(size * 0.42), int(size * 0.72))
    
    draw.polygon([p1, p2, p3, p4], fill=(255, 255, 255, 255))
    draw.polygon([p4, p5, (int(size * 0.56), int(size * 0.57))], fill=(215, 235, 250, 255))
    
    # Xray badge in bottom right (Dark circle with Neon Cyan 'X')
    badge_r = int(size * 0.22)
    bx = size - margin - badge_r
    by = size - margin - badge_r
    draw.ellipse([bx - badge_r, by - badge_r, bx + badge_r, by + badge_r], fill=(24, 30, 42, 255), outline=(0, 230, 180, 255), width=int(size*0.025))
    
    # Draw 'X' on badge
    x_offset = int(badge_r * 0.50)
    w = int(size * 0.035)
    draw.line([bx - x_offset, by - x_offset, bx + x_offset, by + x_offset], fill=(0, 230, 180, 255), width=w)
    draw.line([bx - x_offset, by + x_offset, bx + x_offset, by - x_offset], fill=(0, 230, 180, 255), width=w)
    
    return img

def create_tray_icon(size=64, status_color=(128, 128, 128, 255)):
    # Clean tray icon with status dot
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    margin = 4
    draw.ellipse([margin, margin, size - margin, size - margin], fill=(42, 171, 238, 255))
    
    # Minimalist airplane
    p1 = (int(size * 0.22), int(size * 0.50))
    p2 = (int(size * 0.78), int(size * 0.26))
    p3 = (int(size * 0.62), int(size * 0.76))
    p4 = (int(size * 0.48), int(size * 0.60))
    draw.polygon([p1, p2, p3, p4], fill=(255, 255, 255, 255))
    
    # Status dot in bottom right
    dot_r = 10
    cx = size - dot_r - 2
    cy = size - dot_r - 2
    draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=status_color, outline=(20, 25, 35, 255), width=2)
    return img

out_dir = "resources/icons"
os.makedirs(out_dir, exist_ok=True)
app_icon = create_tg_xray_icon(512)
app_icon.save(f"{out_dir}/icon.png", format="PNG")
app_icon.save(f"{out_dir}/source.png", format="PNG")

# App sizes
for s in [16, 24, 32, 48, 64, 128, 256]:
    app_icon.resize((s, s), Image.Resampling.LANCZOS).save(f"{out_dir}/icon_{s}x{s}.png", format="PNG")

# Windows ico
app_icon.save(f"{out_dir}/icon.ico", format="ICO", sizes=[(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)])

# Status tray icons
create_tray_icon(64, (128, 140, 150, 255)).save(f"{out_dir}/tray-disconnected.png", format="PNG")
create_tray_icon(64, (241, 196, 15, 255)).save(f"{out_dir}/tray-connecting.png", format="PNG")
create_tray_icon(64, (46, 204, 113, 255)).save(f"{out_dir}/tray-connected.png", format="PNG")
create_tray_icon(64, (231, 76, 60, 255)).save(f"{out_dir}/tray-error.png", format="PNG")
create_tray_icon(64, (42, 171, 238, 255)).save(f"{out_dir}/tray.png", format="PNG")

# Generate badges with large bold TrueType font
def generate_badges():
    base_icons = {
        'connected': f"{out_dir}/tray-connected.png",
        'disconnected': f"{out_dir}/tray-disconnected.png",
        'connecting': f"{out_dir}/tray-connecting.png",
        'error': f"{out_dir}/tray-error.png"
    }
    badges_dir = f"{out_dir}/badges"
    os.makedirs(badges_dir, exist_ok=True)
    
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    font_1 = ImageFont.truetype(font_path, 25)
    font_2 = ImageFont.truetype(font_path, 21)
    font_3 = ImageFont.truetype(font_path, 17)
    
    counts = [str(i) for i in range(1, 100)] + ["99+"]
    for status, base_file in base_icons.items():
        base_status_img = Image.open(base_file).convert("RGBA")
        size = base_status_img.size[0]
        for c in counts:
            img = base_status_img.copy()
            draw = ImageDraw.Draw(img)
            text = c
            font = font_1 if len(text) == 1 else (font_2 if len(text) == 2 else font_3)
            bbox = draw.textbbox((0, 0), text, font=font)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            if len(text) == 1:
                bw, bh, radius = 30, 30, 15
            elif len(text) == 2:
                bw, bh, radius = 36, 30, 15
            else:
                bw, bh, radius = 42, 28, 14
            x2 = size
            x1 = x2 - bw
            y1 = 0
            y2 = y1 + bh
            draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=(235, 47, 47, 255), outline=(15, 20, 28, 255), width=2)
            tx = x1 + (bw - tw) / 2 - bbox[0]
            ty = y1 + (bh - th) / 2 - bbox[1]
            draw.text((tx, ty), text, fill=(255, 255, 255, 255), font=font)
            safe_name = "99plus" if c == "99+" else c
            img.save(f"{badges_dir}/{status}-{safe_name}.png", format="PNG")

generate_badges()
print("All icons and badges successfully generated in resources/icons/")
