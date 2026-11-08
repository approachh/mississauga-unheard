import pandas as pd

df = pd.read_csv("outputs/speech_results.csv", encoding="utf-8-sig")
acc = df[df["dataset"] == "accent"]

print("Records per language:")
print(acc.groupby("language").size(), "\n")

native = acc[acc["language"] == "English"]
accented = acc[acc["language"] != "English"]

print(f"Native English: {native['file'].nunique()} people, "
      f"WER = {native['wer'].mean():.1%}, CER = {native['cer'].mean():.1%}")
print(f"With accent:    {accented['file'].nunique()} people, "
      f"{accented['language'].nunique()} languages, "
      f"WER = {accented['wer'].mean():.1%}, CER = {accented['cer'].mean():.1%}")

print("\nWorst 5 recordings:")
print(accented.sort_values("wer", ascending=False)
      [["language", "file", "wer", "prediction"]].head(5).to_string(index=False))