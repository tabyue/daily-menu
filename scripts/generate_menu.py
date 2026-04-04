"""
每日家庭菜谱生成器
由 GitHub Actions 每日自动调用，通过 AI 生成未来5天的菜谱数据。
每道菜同时生成2个备选替换方案，供前端「换一个」功能使用。
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

# 尝试导入 openai，如果不存在则提示安装
try:
    from openai import OpenAI
except ImportError:
    print("ERROR: openai package not installed. Run: pip install openai")
    sys.exit(1)


def get_season(month: int) -> dict:
    """根据月份返回季节信息和时令食材"""
    seasons = {
        "spring": {
            "name": "春季",
            "months": [3, 4, 5],
            "vegetables": "春笋、荠菜、菠菜、豌豆尖、香椿、蚕豆、莴笋、韭菜、芦笋、马兰头、蕨菜",
            "fruits": "草莓、枇杷、樱桃、菠萝、桑葚、青梅",
            "tips": "春季养肝，宜清淡鲜美，多吃绿色蔬菜",
        },
        "summer": {
            "name": "夏季",
            "months": [6, 7, 8],
            "vegetables": "丝瓜、苦瓜、黄瓜、茄子、空心菜、冬瓜、毛豆、秋葵、番茄、豇豆、藕",
            "fruits": "西瓜、桃子、荔枝、芒果、李子、杨梅、葡萄、哈密瓜",
            "tips": "夏季清热祛暑，宜清淡爽口，注意补水和电解质",
        },
        "autumn": {
            "name": "秋季",
            "months": [9, 10, 11],
            "vegetables": "莲藕、山药、芋头、南瓜、白萝卜、花菜、菱角、百合、板栗、银耳",
            "fruits": "柿子、石榴、橘子、梨、苹果、山楂、猕猴桃、柚子",
            "tips": "秋季润燥养肺，宜温润滋补，适当食用白色食物",
        },
        "winter": {
            "name": "冬季",
            "months": [12, 1, 2],
            "vegetables": "大白菜、萝卜、冬笋、大葱、蒜苗、荸荠、菠菜、芥蓝、豆苗",
            "fruits": "橙子、柚子、砂糖橘、甘蔗、苹果、猕猴桃",
            "tips": "冬季温补驱寒，宜炖煮温热，适当增加热量摄入",
        },
    }

    for season_key, info in seasons.items():
        if month in info["months"]:
            return info
    return seasons["spring"]


def build_prompt(date_str: str, season_info: dict, recent_menus: list) -> str:
    """构建 AI 生成菜谱的 Prompt"""

    # 获取星期
    date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    weekday_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    weekday = weekday_names[date_obj.weekday()]
    is_weekend = date_obj.weekday() >= 5  # 周六日

    # 判断是否为节假日（周末 + 常见法定假日简单判断）
    is_holiday = is_weekend
    month_day = date_str[5:]  # MM-DD
    holiday_ranges = [
        ("01-01", "01-03"),  # 元旦
        ("01-28", "02-04"),  # 春节（大致范围）
        ("04-04", "04-06"),  # 清明
        ("05-01", "05-05"),  # 劳动节
        ("06-08", "06-10"),  # 端午（大致）
        ("09-15", "09-17"),  # 中秋（大致）
        ("10-01", "10-07"),  # 国庆
    ]
    for start, end in holiday_ranges:
        if start <= month_day <= end:
            is_holiday = True
            break

    if is_holiday:
        family_desc = "2位成年人（爸爸妈妈）+ 1位十几岁男孩（青少年）= 3人份"
        family_note = "今天是节假日/周末，爸爸在家一起吃，菜量要按3人份准备，可以做些费时但更丰盛的菜"
    else:
        family_desc = "1位成年人（妈妈）+ 1位十几岁男孩（青少年）= 2人份"
        family_note = "今天是工作日，妈妈和儿子两人吃，菜量按2人份准备，注重简单高效又营养"

    recent_dishes = ""
    if recent_menus:
        recent_dishes = "\n最近几天已做过的菜（请避免重复）：\n"
        for menu in recent_menus:
            try:
                d = menu.get("date", "")
                dishes = []
                for meal_key in ["breakfast", "lunch", "dinner"]:
                    for dish in menu.get(meal_key, []):
                        dishes.append(dish.get("name", ""))
                        # 也收集备选菜名
                        for alt in dish.get("alternatives", []):
                            dishes.append(alt.get("name", ""))
                recent_dishes += f"- {d}: {', '.join(dishes)}\n"
            except Exception:
                pass

    prompt = f"""你是一位专业的家庭营养师和厨师。请为 {date_str}（{weekday}）生成一份详细的家庭菜谱。

## 家庭情况
- 坐标：广东深圳
- 今日用餐人数：{family_desc}
- {family_note}

## 基本要求
- 严格遵循《中国居民膳食指南(2022)》和中国儿童青少年膳食营养标准
- 每日需包含：早餐、午餐、晚餐、水果、零食/加餐
- 食材用量请按实际人数标注

## 当前季节：{season_info['name']}
- 时令蔬菜：{season_info['vegetables']}
- 时令水果：{season_info['fruits']}
- 养生要点：{season_info['tips']}

## 地域与口味要求
- 家在深圳，日常偏广东饮食习惯，但不局限于粤菜
- 结合中国南北方口味，可以包含川菜、湘菜、粤菜、北方面食、客家菜等
- 能吃辣，可包含酸、甜、辣、麻等多种口味
- 适当融入广东特色：煲汤、肠粉、烧腊、糖水等
- 主食兼顾大米和面食（馒头、面条、饼、饺子等），不要每天都是米饭
- 每天至少一道时令蔬菜
- 早餐要丰富，不能太单调
- 深圳四季水果丰富，善用热带/亚热带水果

## 营养均衡要求
- 每日蛋白质来源多样（肉、蛋、奶、豆、鱼虾）
- 深圳靠海，适当多安排海鲜/鱼类
- 蔬菜种类不少于3种/天，深色蔬菜占一半以上
- 注意钙、铁、锌的摄入（青少年生长发育需要）
- 晚餐相对清淡，不宜过重
- 水果每天2种以上

{recent_dishes}

## 换菜备选要求（重要！）
- 早餐、午餐、晚餐中的每道菜，都需要额外提供 **2个备选替换方案**
- 备选菜必须与原菜在营养角色上相近（如：蛋白质菜换蛋白质菜，蔬菜换蔬菜，主食换主食）
- 备选菜不能与当天其他菜重复
- 备选菜放在每道菜的 "alternatives" 字段中
- 水果和零食不需要备选

## 输出格式要求
请严格按照以下 JSON 格式输出，不要输出任何 JSON 以外的内容：

```json
{{
  "date": "{date_str}",
  "summary": "今日膳食总结（一句话概括特色）",
  "tags": ["标签1", "标签2", "标签3", "标签4"],
  "breakfast": [
    {{
      "name": "菜名",
      "emoji": "一个贴切的emoji",
      "desc": "简短描述（15字以内）",
      "amount": "具体用量",
      "tags": [{{"type": "staple|protein|veggie|seasonal|spicy|sweet|sour", "label": "显示文字"}}],
      "recipe": {{
        "ingredients": ["食材1及用量", "食材2及用量"],
        "steps": ["步骤1", "步骤2", "步骤3"],
        "tips": ["小窍门1"]
      }},
      "alternatives": [
        {{
          "name": "备选菜名1",
          "emoji": "emoji",
          "desc": "描述",
          "amount": "用量",
          "tags": [...],
          "recipe": {{ "ingredients": [...], "steps": [...], "tips": [...] }}
        }},
        {{
          "name": "备选菜名2",
          "emoji": "emoji",
          "desc": "描述",
          "amount": "用量",
          "tags": [...],
          "recipe": {{ "ingredients": [...], "steps": [...], "tips": [...] }}
        }}
      ]
    }}
  ],
  "lunch": [...],
  "dinner": [...],
  "fruit": [
    {{
      "name": "水果名",
      "emoji": "emoji",
      "desc": "简短描述",
      "amount": "用量",
      "tags": [{{"type": "seasonal", "label": "时令"}}],
      "recipe": null
    }}
  ],
  "snack": [
    {{
      "name": "零食名",
      "emoji": "emoji",
      "desc": "简短描述",
      "amount": "用量",
      "tags": [],
      "recipe": null
    }}
  ],
  "tips": ["营养小贴士1", "营养小贴士2", "营养小贴士3", "营养小贴士4"]
}}
```

注意事项：
1. 每个 recipe 如果是简单食物（如白煮蛋、牛奶等）可以设为 null
2. tags 的 type 只能是以下之一：staple protein veggie seasonal spicy sweet sour
3. alternatives 每个菜提供2个备选，格式和主菜完全一致（含 recipe）
4. 简单食物（白煮蛋、牛奶等）的 alternatives 可以为空数组 []
5. 水果和零食不需要 alternatives 字段
6. 备选菜要和原菜营养角色一致，且不与当日其他菜重复
7. 做法步骤要详细实用，新手也能看懂
8. 食材用量要精确到克/个/勺

请直接输出 JSON，不要包含 ```json 标记或其他文本。"""

    return prompt


def generate_menu(client: OpenAI, date_str: str, season_info: dict, recent_menus: list, model: str = "gpt-4o") -> dict:
    """调用 AI 生成菜谱，支持重试"""
    prompt = build_prompt(date_str, season_info, recent_menus)
    max_retries = 3

    for attempt in range(1, max_retries + 1):
        try:
            print(f"  Attempt {attempt}/{max_retries}...")
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "你是一位专业的家庭营养师和中国菜厨师。请严格按照要求的JSON格式输出菜谱数据，不要输出任何JSON以外的内容。每道菜必须包含alternatives备选字段。",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.8,
                max_tokens=8000,
            )

            content = response.choices[0].message.content.strip()

            # 清理可能的 markdown 代码块标记
            if content.startswith("```"):
                content = content.split("\n", 1)[1]
            if content.endswith("```"):
                content = content.rsplit("```", 1)[0]
            content = content.strip()

            menu_data = json.loads(content)
            return menu_data

        except json.JSONDecodeError as e:
            print(f"  ERROR: Failed to parse AI response as JSON: {e}")
            print(f"  Response content (first 300 chars): {content[:300]}")
            if attempt < max_retries:
                print(f"  Retrying in 10 seconds...")
                time.sleep(10)
            else:
                return None
        except Exception as e:
            error_msg = str(e)
            print(f"  ERROR: AI API call failed: {error_msg[:200]}")
            if attempt < max_retries:
                wait_time = 15 * attempt  # 递增等待：15s, 30s
                print(f"  Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                print(f"  All {max_retries} attempts failed.")
                return None


def load_recent_menus(data_dir: Path, today: datetime, days_back: int = 7) -> list:
    """加载最近几天的菜谱数据，用于避免重复"""
    menus = []
    for i in range(1, days_back + 1):
        date = today - timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        file_path = data_dir / f"{date_str}.json"
        if file_path.exists():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    menus.append(json.load(f))
            except Exception:
                pass
    return menus


def main():
    # 配置 - 支持自定义 base_url / api_key / model
    api_key = os.environ.get("OPENAI_API_KEY")
    api_base = os.environ.get("OPENAI_API_BASE", None)
    model = os.environ.get("OPENAI_MODEL", "gpt-4o")

    if not api_key:
        print("ERROR: OPENAI_API_KEY environment variable is required")
        sys.exit(1)

    # 初始化客户端 - 兼容任何 OpenAI 兼容 API
    # 设置较长超时：生成含备选方案的完整菜谱需要较多时间
    from httpx import Timeout
    client_kwargs = {
        "api_key": api_key,
        "timeout": Timeout(300.0, connect=30.0),  # 总超时5分钟，连接超时30秒
    }
    if api_base:
        client_kwargs["base_url"] = api_base
    client = OpenAI(**client_kwargs)

    # 路径
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data"
    data_dir.mkdir(exist_ok=True)

    # 日期范围：今天 + 未来4天 = 5天
    today = datetime.now()
    dates_to_generate = []
    for i in range(5):
        d = today + timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        file_path = data_dir / f"{date_str}.json"

        # 已有数据的日期跳过（不覆盖已规划好的菜谱）
        if file_path.exists():
            print(f"SKIP: {date_str} already exists (won't overwrite)")
            continue
        dates_to_generate.append(date_str)

    if not dates_to_generate:
        print("All menus for the next 5 days already exist. Nothing to generate.")
        return

    # 加载近期菜谱 + 已有的未来菜谱，用于避免重复
    recent_menus = load_recent_menus(data_dir, today)

    # 也加载已有的未来日期菜谱
    for i in range(5):
        d = today + timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        file_path = data_dir / f"{date_str}.json"
        if file_path.exists():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    recent_menus.append(json.load(f))
            except Exception:
                pass

    # 生成菜谱
    for date_str in dates_to_generate:
        print(f"Generating menu for {date_str}...")
        month = int(date_str.split("-")[1])
        season_info = get_season(month)

        menu = generate_menu(client, date_str, season_info, recent_menus, model)
        if menu:
            file_path = data_dir / f"{date_str}.json"
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(menu, f, ensure_ascii=False, indent=2)
            print(f"SUCCESS: Saved {file_path}")

            # 加入 recent 避免下一天重复
            recent_menus.insert(0, menu)
        else:
            print(f"FAILED: Could not generate menu for {date_str}")


if __name__ == "__main__":
    main()
