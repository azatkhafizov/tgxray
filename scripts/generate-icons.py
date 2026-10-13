import os
from PIL import Image, ImageDraw

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

print("All icons successfully generated in resources/icons/")
