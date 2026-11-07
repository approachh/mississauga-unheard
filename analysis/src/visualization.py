import pandas as pd
import matplotlib.pyplot as plt


df1 = pd.read_csv('../../../../data/language_coverage_validated.csv')
df2 = pd.read_csv('../../../../data/citywide_language_ranking_VALIDATED.csv')
df3 = pd.read_csv('../../../../data/ward_language_profile_2021_VALIDATED.csv')

top_languages = df1.groupby('language')['home_speakers_citywide_validated'].sum().nlargest(10)
city_wide = df2.groupby('language')['home_speakers_citywide'].sum().nlargest(10)
language_ward = df3.groupby('ward')['home_urdu']


plt.figure(figsize=(10,6))

top_languages.sort_values().plot(kind='barh', color='blue')


plt.title("Top 10 most spoken languages in Mississauga")
plt.xlabel("Home Speakers")
plt.ylabel("Languages")

plt.tight_layout()

plt.show()


arabic_data = df2[df2['language'] == 'Arabic']

df2.head(10).sort_values(by='home_speakers_citywide', ascending=True).plot(
    kind='barh', x='language', y='home_speakers_citywide', color='green'
)
plt.title("Top 10 Language Rankings Citywide")
plt.xlabel("Home Speakers")
plt.ylabel("Languages")
plt.tight_layout()
plt.show()


df3.set_index('ward')
plt.figure(figsize=(12, 6))
df3.sort_values(by='ward').plot(
    kind='bar', x='ward', y='home_urdu', color='orange'
)
plt.title("Urdu Speakers Across Wards in Mississauga")
plt.xlabel("Ward")
plt.ylabel("Home Speakers")
plt.tight_layout()
plt.show()

