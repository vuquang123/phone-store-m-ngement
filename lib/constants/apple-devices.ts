// ---------------------------------------------------------------------------
// Danh mục máy Apple dùng chung cho MỌI form nhập máy (kho hàng, bảo hành, CNC).
//
// Trước đây mỗi dialog tự chép một mảng `defaultIphoneNames` riêng -> thêm một
// đời máy mới phải sửa 3 nơi và rất dễ sót. Tất cả gom về đây.
//
// Thứ tự: MỚI NHẤT TRƯỚC (ngược với thứ tự ra mắt) vì máy đời mới được chọn
// nhiều nhất — nhân viên không phải cuộn xuống cuối danh sách.
// ---------------------------------------------------------------------------

export const IPHONE_NAMES = [
  "iPhone Duo",
  "iPhone 18 Pro Max",
  "iPhone 18 Pro",
  "iPhone 17e",
  "iPhone 17 Pro Max",
  "iPhone 17 Pro",
  "iPhone Air",
  "iPhone 17",
  "iPhone 16e",
  "iPhone 16 Pro Max",
  "iPhone 16 Pro",
  "iPhone 16 Plus",
  "iPhone 16",
  "iPhone 15 Pro Max",
  "iPhone 15 Pro",
  "iPhone 15 Plus",
  "iPhone 15",
  "iPhone 14 Pro Max",
  "iPhone 14 Pro",
  "iPhone 14 Plus",
  "iPhone 14",
  "iPhone SE (3rd generation)",
  "iPhone 13 Pro Max",
  "iPhone 13 Pro",
  "iPhone 13",
  "iPhone 13 mini",
  "iPhone 12 Pro Max",
  "iPhone 12 Pro",
  "iPhone 12",
  "iPhone 12 mini",
  "iPhone SE (2nd generation)",
  "iPhone 11 Pro Max",
  "iPhone 11 Pro",
  "iPhone 11",
  "iPhone XR",
  "iPhone XS Max",
  "iPhone XS",
  "iPhone X",
  "iPhone 8 Plus",
  "iPhone 8",
] as const

export const IPAD_NAMES = [
  "iPad Air 13-inch (M4)",
  "iPad Air 11-inch (M4)",
  "iPad Pro 13-inch (M5)",
  "iPad Pro 11-inch (M5)",
  "iPad Air 13-inch (M3)",
  "iPad Air 11-inch (M3)",
  "iPad (A16)",
  "iPad mini (A17 Pro)",
  "iPad Pro 13-inch (M4)",
  "iPad Pro 11-inch (M4)",
  "iPad Air 13-inch (M2)",
  "iPad Air 11-inch (M2)",
  "iPad Pro 12.9-inch (6th generation)",
  "iPad Pro 11-inch (4th generation)",
  "iPad (10th generation)",
  "iPad Air (5th generation)",
  "iPad mini (6th generation)",
  "iPad (9th generation)",
  "iPad Pro 12.9-inch (5th generation)",
  "iPad Pro 11-inch (3rd generation)",
  "iPad Air (4th generation)",
  "iPad (8th generation)",
  "iPad Pro 12.9-inch (4th generation)",
  "iPad Pro 11-inch (2nd generation)",
  "iPad (7th generation)",
  "iPad Air (3rd generation)",
  "iPad mini (5th generation)",
  "iPad Pro 12.9-inch (3rd generation)",
  "iPad Pro 11-inch (1st generation)",
  "iPad (6th generation)",
  "iPad Pro 12.9-inch (2nd generation)",
  "iPad Pro 10.5-inch",
  "iPad (5th generation)",
] as const

/** Dropdown "Tên sản phẩm" cho form nhập kho / bảo hành: iPhone trước, iPad sau. */
export const DEVICE_NAME_OPTIONS: string[] = [...IPHONE_NAMES, ...IPAD_NAMES]

export function isIpadName(name?: string) {
  return /^\s*ipad/i.test(String(name || ""))
}

// iPad 5/6 còn bản 32GB; iPad Pro M4/M5 lên tới 2TB -> dải rộng hơn iPhone.
export const STORAGE_OPTIONS = ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB", "2TB"]

// iPad không có khái niệm Lock/Quốc tế; phân biệt theo việc có khe SIM hay không
// — cũng chính là lý do bản Wi-Fi chỉ có Serial, không có IMEI.
export const IPHONE_LOAI_MAY_OPTIONS = ["Lock", "Quốc tế"]
export const IPAD_LOAI_MAY_OPTIONS = ["Wifi", "Wifi + Cellular"]

export function getLoaiMayOptions(tenSanPham?: string) {
  return isIpadName(tenSanPham) ? IPAD_LOAI_MAY_OPTIONS : IPHONE_LOAI_MAY_OPTIONS
}

// Bảng màu chính hãng theo từng đời máy.
export const COLOR_OPTIONS: Record<string, string[]> = {
  // --- iPhone ---
  "iPhone 17": ["Black", "Lavender", "Mist Blue", "Sage", "White"],
  "iPhone 17 Pro Max": ["Deep Blue", "Cosmic Orange", "Silver"],
  "iPhone 17 Pro": ["Deep Blue", "Cosmic Orange", "Silver"],
  "iPhone Air": ["Cloud White", "Light Gold", "Sky Blue", "Space Black"],
  "iPhone 17e": ["Soft Pink", "Black", "White"],
  "iPhone 16 Pro Max": ["Black Titanium", "Natural Titanium", "White Titanium", "Desert Titanium"],
  "iPhone 16 Pro": ["Black Titanium", "Natural Titanium", "White Titanium", "Desert Titanium"],
  "iPhone 16 Plus": ["Black", "White", "Pink", "Teal", "Ultramarine"],
  "iPhone 16": ["Black", "White", "Pink", "Teal", "Ultramarine"],
  "iPhone 16e": ["Black", "White"],
  "iPhone 15 Pro Max": ["Black Titanium", "White Titanium", "Blue Titanium", "Natural Titanium"],
  "iPhone 15 Pro": ["Black Titanium", "White Titanium", "Blue Titanium", "Natural Titanium"],
  "iPhone 15 Plus": ["Pink", "Yellow", "Green", "Blue", "Black"],
  "iPhone 15": ["Pink", "Yellow", "Green", "Blue", "Black"],
  "iPhone 14 Pro Max": ["Silver", "Gold", "Space Black", "Deep Purple"],
  "iPhone 14 Pro": ["Silver", "Gold", "Space Black", "Deep Purple"],
  "iPhone 14 Plus": ["Midnight", "Starlight", "(PRODUCT)RED", "Blue", "Purple", "Yellow"],
  "iPhone 14": ["Midnight", "Starlight", "(PRODUCT)RED", "Blue", "Purple", "Yellow"],
  "iPhone SE (3rd generation)": ["Midnight", "Starlight", "(PRODUCT)RED"],
  "iPhone 13 Pro Max": ["Graphite", "Gold", "Silver", "Sierra Blue", "Alpine Green"],
  "iPhone 13 Pro": ["Graphite", "Gold", "Silver", "Sierra Blue", "Alpine Green"],
  "iPhone 13": ["(PRODUCT)RED", "Starlight", "Midnight", "Blue", "Pink", "Green"],
  "iPhone 13 mini": ["(PRODUCT)RED", "Starlight", "Midnight", "Blue", "Pink", "Green"],
  "iPhone 12 Pro Max": ["Silver", "Graphite", "Gold", "Pacific Blue"],
  "iPhone 12 Pro": ["Silver", "Graphite", "Gold", "Pacific Blue"],
  "iPhone 12": ["Black", "White", "(PRODUCT)RED", "Green", "Blue", "Purple"],
  "iPhone 12 mini": ["Black", "White", "(PRODUCT)RED", "Green", "Blue", "Purple"],
  "iPhone SE (2nd generation)": ["Black", "White", "(PRODUCT)RED"],
  "iPhone 11 Pro Max": ["Silver", "Space Gray", "Gold", "Midnight Green"],
  "iPhone 11 Pro": ["Silver", "Space Gray", "Gold", "Midnight Green"],
  "iPhone 11": ["Purple", "Green", "Yellow", "Black", "White", "(PRODUCT)RED"],
  "iPhone XR": ["Black", "White", "Blue", "Yellow", "Coral", "(PRODUCT)RED"],
  "iPhone XS Max": ["Space Gray", "Silver", "Gold"],
  "iPhone XS": ["Space Gray", "Silver", "Gold"],
  "iPhone X": ["Space Gray", "Silver"],
  "iPhone 8 Plus": ["Space Gray", "Silver", "Gold", "(PRODUCT)RED"],
  "iPhone 8": ["Space Gray", "Silver", "Gold", "(PRODUCT)RED"],

  // --- iPad ---
  "iPad Air 13-inch (M4)": ["Space Gray", "Starlight", "Purple", "Blue"],
  "iPad Air 11-inch (M4)": ["Space Gray", "Starlight", "Purple", "Blue"],
  "iPad Pro 13-inch (M5)": ["Silver", "Space Black"],
  "iPad Pro 11-inch (M5)": ["Silver", "Space Black"],
  "iPad Air 13-inch (M3)": ["Space Gray", "Starlight", "Purple", "Blue"],
  "iPad Air 11-inch (M3)": ["Space Gray", "Starlight", "Purple", "Blue"],
  "iPad (A16)": ["Silver", "Blue", "Pink", "Yellow"],
  "iPad mini (A17 Pro)": ["Space Gray", "Blue", "Purple", "Starlight"],
  "iPad Pro 13-inch (M4)": ["Silver", "Space Black"],
  "iPad Pro 11-inch (M4)": ["Silver", "Space Black"],
  "iPad Air 13-inch (M2)": ["Space Gray", "Starlight", "Purple", "Blue"],
  "iPad Air 11-inch (M2)": ["Space Gray", "Starlight", "Purple", "Blue"],
  "iPad Pro 12.9-inch (6th generation)": ["Silver", "Space Gray"],
  "iPad Pro 11-inch (4th generation)": ["Silver", "Space Gray"],
  "iPad (10th generation)": ["Silver", "Blue", "Pink", "Yellow"],
  "iPad Air (5th generation)": ["Space Gray", "Starlight", "Pink", "Purple", "Blue"],
  "iPad mini (6th generation)": ["Space Gray", "Pink", "Purple", "Starlight"],
  "iPad (9th generation)": ["Silver", "Space Gray"],
  "iPad Pro 12.9-inch (5th generation)": ["Silver", "Space Gray"],
  "iPad Pro 11-inch (3rd generation)": ["Silver", "Space Gray"],
  "iPad Air (4th generation)": ["Silver", "Space Gray", "Rose Gold", "Green", "Sky Blue"],
  "iPad (8th generation)": ["Silver", "Space Gray", "Gold"],
  "iPad Pro 12.9-inch (4th generation)": ["Silver", "Space Gray"],
  "iPad Pro 11-inch (2nd generation)": ["Silver", "Space Gray"],
  "iPad (7th generation)": ["Silver", "Space Gray", "Gold"],
  "iPad Air (3rd generation)": ["Silver", "Space Gray", "Gold"],
  "iPad mini (5th generation)": ["Silver", "Space Gray", "Gold"],
  "iPad Pro 12.9-inch (3rd generation)": ["Silver", "Space Gray"],
  "iPad Pro 11-inch (1st generation)": ["Silver", "Space Gray"],
  "iPad (6th generation)": ["Silver", "Space Gray", "Gold"],
  "iPad Pro 12.9-inch (2nd generation)": ["Silver", "Space Gray", "Gold", "Rose Gold"],
  "iPad Pro 10.5-inch": ["Silver", "Space Gray", "Gold", "Rose Gold"],
  "iPad (5th generation)": ["Silver", "Space Gray", "Gold"],
}

// Máy chưa có trong bảng màu (đời mới chưa công bố, máy cũ hiếm...) vẫn phải
// chọn được màu, vì "Màu Sắc" là trường bắt buộc — thiếu fallback là kẹt form.
export const FALLBACK_COLORS = [
  "Black",
  "White",
  "Silver",
  "Space Black",
  "Space Gray",
  "Gold",
  "Natural Titanium",
  "Midnight",
  "Starlight",
  "Blue",
  "Green",
  "Pink",
  "Purple",
  "Yellow",
  "(PRODUCT)RED",
]

export function getColorOptions(tenSanPham?: string) {
  const mapped = COLOR_OPTIONS[String(tenSanPham || "")]
  return mapped && mapped.length ? mapped : FALLBACK_COLORS
}
