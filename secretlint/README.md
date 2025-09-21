# Secretlint Config Merger

Công cụ để merge file cấu hình secretlint.

## Cách sử dụng

```bash
# Chỉ sử dụng config mặc định
node merge.js

# Merge với file config từ project khác  
node merge.js <đường-dẫn-đến-file-config-external>
```

### Ví dụ:

```bash
# Sử dụng default config only
node merge.js

# Merge với file config từ project khác
node merge.js ../my-project/.secretlintrc.json

# Merge với file config từ đường dẫn tuyệt đối
node merge.js /path/to/project/.secretlintrc.json
```

## Cách hoạt động

1. **Input**: 
   - File mặc định: `.default.secretlintrc.json`
   - File external được truyền qua command line argument (optional)

2. **Process**:
   - Đọc file default config
   - Nếu không có external config: sử dụng default config
   - Nếu external config không tồn tại: sử dụng default config với warning
   - Nếu external config empty: sử dụng default config
   - Nếu external config không có rules: merge properties khác với default rules
   - Merge các rules theo logic:
     - Nếu rule đã tồn tại (theo `id`): merge options
     - Nếu rule chưa tồn tại: thêm rule mới
     - Đối với `patterns` array: 
       - Nếu có patterns cùng `name`: merge chúng lại
       - Nếu patterns khác nhau: combine với OR operator  
       - Nếu patterns giống nhau: update thuộc tính khác
       - Pattern mới: thêm vào danh sách

3. **Output**: File `.secretlintrc.json`

## Ví dụ merge

### File mặc định (`.default.secretlintrc.json`):
```json
{
    "rules": [
        {
            "id": "@secretlint/secretlint-rule-preset-recommend"
        },
        {
            "id": "@secretlint/secretlint-rule-pattern",
            "options": {
                "patterns": [
                    {
                        "name": "General Secret",
                        "pattern": "/pattern1/gi"
                    }
                ]
            }
        }
    ]
}
```

### File external:
```json
{
    "rules": [
        {
            "id": "@secretlint/secretlint-rule-pattern",
            "options": {
                "patterns": [
                    {
                        "name": "API Key",
                        "pattern": "/api[_-]?key/gi"
                    }
                ]
            }
        },
        {
            "id": "@secretlint/secretlint-rule-aws"
        }
    ]
}
```

### Kết quả merge (`.secretlintrc.json`):
```json
{
    "rules": [
        {
            "id": "@secretlint/secretlint-rule-preset-recommend"
        },
        {
            "id": "@secretlint/secretlint-rule-pattern",
            "options": {
                "patterns": [
                    {
                        "name": "General Secret",
                        "pattern": "/pattern1/gi"
                    },
                    {
                        "name": "API Key", 
                        "pattern": "/api[_-]?key/gi"
                    }
                ]
            }
        },
        {
            "id": "@secretlint/secretlint-rule-aws"
        }
    ]
}
```

## Error Handling

Script sẽ hiển thị thông báo rõ ràng khi:
- File default không tồn tại (exit with error)
- File JSON không hợp lệ (exit with error)

## Graceful Handling

Script sẽ xử lý gracefully các trường hợp:
- ✅ Không có external config: sử dụng default config
- ✅ External config không tồn tại: warning + sử dụng default config  
- ✅ External config empty: sử dụng default config
- ✅ External config không có rules: merge properties + default rules

## Features

- ✅ Deep merge các rule options
- ✅ Merge duplicate patterns intelligently:
  - Combine patterns với cùng name bằng OR operator
  - Update thuộc tính cho patterns trùng lặp
  - Preserve unique patterns
- ✅ Thêm rules mới
- ✅ Preserve cấu trúc config gốc  
- ✅ Error handling chi tiết
- ✅ Summary report sau khi merge

## Xử lý Duplicate Patterns

Khi có patterns trùng lặp (cùng `name`):

### Case 1: Patterns khác nhau
```json
// Default: "General Secret" với pattern A
// External: "General Secret" với pattern B  
// Result: "General Secret (Combined)" với pattern: /(A)|(B)/gi
```

### Case 2: Patterns giống nhau
```json
// Default: { "name": "API Key", "pattern": "/api/gi" }
// External: { "name": "API Key", "pattern": "/api/gi", "message": "Found API key" }
// Result: { "name": "API Key", "pattern": "/api/gi", "message": "Found API key" }
```