import os
from typing import Type
from pydantic import BaseModel, Field
from langchain.tools import BaseTool
from langchain_openai import ChatOpenAI
from langchain_classic.agents import AgentExecutor
from langchain_classic.agents.openai_tools.base import create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from dotenv import load_dotenv
from .api_client import CongressAPIClient
from ..google_civic_client import GoogleCivicClient
from ..brave_search_client import BraveSearchClient

load_dotenv()

class MemberSearchInput(BaseModel):
    name: str = Field(description="The name of the Congress member to search for")

class MemberDetailsInput(BaseModel):
    bioguide_id: str = Field(description="The Bioguide ID of the Congress member")

class MemberStateSearchInput(BaseModel):
    state_code: str = Field(description="The 2-letter state code (e.g., 'NJ', 'NY', 'CA')")

class MemberSearchTool(BaseTool):
    name: str = "search_congress_member_by_name"
    description: str = "Search for a Congress member by name to get their Bioguide ID and basic info"
    args_schema: Type[BaseModel] = MemberSearchInput
    client: CongressAPIClient = Field(default_factory=CongressAPIClient)

    def _run(self, name: str):
        member = self.client.search_member_by_name(name)
        if member:
            return member
        return f"No member found with name: {name}"

class MemberStateSearchTool(BaseTool):
    name: str = "search_congress_members_by_state"
    description: str = "Get a list of Congress members representing a specific state using its 2-letter code"
    args_schema: Type[BaseModel] = MemberStateSearchInput
    client: CongressAPIClient = Field(default_factory=CongressAPIClient)

    def _run(self, state_code: str):
        members = self.client.get_members(state=state_code, limit=100)
        if members:
            # Return a concise list to avoid overwhelming the LLM
            return [{"name": m.get("name"), "bioguideId": m.get("bioguideId"), "party": m.get("partyName")} for m in members]
        return f"No members found for state: {state_code}"

class MemberDetailsTool(BaseTool):
    name: str = "get_congress_member_details"
    description: str = "Get detailed information about a Congress member using their Bioguide ID"
    args_schema: Type[BaseModel] = MemberDetailsInput
    client: CongressAPIClient = Field(default_factory=CongressAPIClient)

    def _run(self, bioguide_id: str):
        details = self.client.get_member_details(bioguide_id)
        if details:
            return details
        return f"No details found for Bioguide ID: {bioguide_id}"

class MemberLegislationTool(BaseTool):
    name: str = "get_member_sponsored_legislation"
    description: str = "Get a list of legislation sponsored by a Congress member using their Bioguide ID"
    args_schema: Type[BaseModel] = MemberDetailsInput
    client: CongressAPIClient = Field(default_factory=CongressAPIClient)

    def _run(self, bioguide_id: str):
        legislation = self.client.get_sponsored_legislation(bioguide_id, limit=5)
        if legislation:
            return legislation
        return f"No sponsored legislation found for Bioguide ID: {bioguide_id}"

class MemberCommitteesTool(BaseTool):
    name: str = "get_member_committees"
    description: str = "Get the committee assignments for a Congress member using their Bioguide ID"
    args_schema: Type[BaseModel] = MemberDetailsInput
    client: CongressAPIClient = Field(default_factory=CongressAPIClient)

    def _run(self, bioguide_id: str):
        try:
            committees = self.client.get_member_committees(bioguide_id)
            if committees:
                return committees
            return f"No committee assignments found for Bioguide ID: {bioguide_id}"
        except Exception as e:
            return f"Error fetching committees: {str(e)}"

class MemberVotesTool(BaseTool):
    name: str = "get_member_recent_votes"
    description: str = "Get the most recent House roll call votes for a representative using their Bioguide ID"
    args_schema: Type[BaseModel] = MemberDetailsInput
    client: CongressAPIClient = Field(default_factory=CongressAPIClient)

    def _run(self, bioguide_id: str):
        try:
            # 1. Get recent House votes
            recent_votes = self.client.get_recent_house_votes(limit=5)
            if not recent_votes:
                return "No recent House roll call votes found."

            results = []
            for vote in recent_votes:
                congress = vote.get("congress")
                session = vote.get("sessionNumber")
                roll_call = vote.get("rollCallNumber")
                leg_num = vote.get("legislationNumber", "N/A")
                question = vote.get("voteQuestion", "No Question")
                
                # 2. Check how this member voted
                vote_cast = self.client.get_member_vote_on_roll_call(congress, session, roll_call, bioguide_id)
                
                results.append({
                    "legislation": leg_num,
                    "question": question,
                    "vote": vote_cast or "Not Found/Did not vote",
                    "result": vote.get("result"),
                    "date": vote.get("startDate")
                })
            
            return results
        except Exception as e:
            return f"Error fetching voting records: {str(e)}"

class CivicInfoInput(BaseModel):
    address: str = Field(description="The full address or city/state to look up representatives for")

class SearchInput(BaseModel):
    query: str = Field(description="The search query to look up on the web")

class BillSearchInput(BaseModel):
    congress: int = Field(description="The Congress number (e.g., 118)")
    bill_type: str = Field(description="The type of bill (e.g., 'hr', 's', 'hres')")
    bill_number: str = Field(description="The bill number (e.g., '1')")

class GoogleCivicTool(BaseTool):
    name: str = "get_representatives_by_address"
    description: str = "Find your Congressional district and representatives for a specific address or location"
    args_schema: Type[BaseModel] = CivicInfoInput
    civic_client: GoogleCivicClient = Field(default_factory=GoogleCivicClient)
    congress_client: CongressAPIClient = Field(default_factory=CongressAPIClient)

    def _run(self, address: str):
        try:
            # 1. Get divisions from Google Civic API
            division_data = self.civic_client.get_divisions_by_address(address)
            state, district = self.civic_client.extract_district_info(division_data)
            
            result = f"I found the following for: {address}\n"
            
            # 2. Get specific Congressional District info if found
            if state and district is not None:
                result += f"District: {state}-{district}\n"
                
                # Fetch members for this specific district
                district_members = self.congress_client.get_members(state=state, district=district, current_member=True)
                if district_members:
                    result += "\nCurrent Representative:\n"
                    for m in district_members:
                        result += f"- {m.get('name')} (Bioguide ID: {m.get('bioguideId')})\n"
                
                # Fetch all members for the state to find Senators
                all_state_members = self.congress_client.get_members(state=state, current_member=True, limit=50)
                senators = [m for m in all_state_members if m.get('district') is None]
                
                if senators:
                    result += f"\nCurrent Senators for {state}:\n"
                    for s in senators:
                        result += f"- {s.get('name')} (Bioguide ID: {s.get('bioguideId')})\n"
                
                result += f"\nYou can ask me for more details about any of these members by name!"
            else:
                result += "I could not definitively identify a Congressional district for this location. Try providing a more specific address."
            
            return result
        except Exception as e:
            return f"Error fetching civic information: {str(e)}"

class BraveSearchTool(BaseTool):
    name: str = "web_search"
    description: str = "Search the live web for current news, biographies, or information not found in official Congress databases"
    args_schema: Type[BaseModel] = SearchInput
    client: BraveSearchClient = Field(default_factory=BraveSearchClient)

    def _run(self, query: str):
        try:
            data = self.client.search(query)
            return self.client.format_search_results(data)
        except Exception as e:
            return f"Error performing web search: {str(e)}"

class SummarizeBillTool(BaseTool):
    name: str = "summarize_congressional_bill"
    description: str = "Fetch the text of a specific bill and provide a summary. Useful for complex legislation."
    args_schema: Type[BaseModel] = BillSearchInput
    client: CongressAPIClient = Field(default_factory=CongressAPIClient)

    def _run(self, congress: int, bill_type: str, bill_number: str):
        try:
            # 1. Get bill details
            details = self.client.get_bill_details(congress, bill_type, bill_number)
            title = details.get("title", "Unknown Bill")
            
            # 2. Get text versions
            text_versions = self.client.get_bill_text(congress, bill_type, bill_number)
            if not text_versions:
                return f"Summary for {bill_type.upper()} {bill_number}: {title}\n\nNote: Official text is not yet available for this bill in the API."

            # Typically the first or last version is the most useful. 
            # We'll just mention we found the text and let the agent's internal logic 
            # (which handles the response) know it can use its general knowledge if text is short,
            # or we could fetch the actual PDF/XML link if needed.
            # For now, providing titles and metadata is a huge step.
            return f"Bill Title: {title}\nLatest Action: {details.get('latestAction', {}).get('text')}\nText versions found: {len(text_versions)}"
        except Exception as e:
            return f"Error fetching bill summary: {str(e)}"

def get_cosint_agent(streaming: bool = False):
    from datetime import datetime
    current_date = datetime.now().strftime("%A, %B %d, %Y")
    
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, streaming=streaming)
    tools = [
        MemberSearchTool(), 
        MemberStateSearchTool(), 
        MemberDetailsTool(), 
        MemberLegislationTool(),
        MemberCommitteesTool(),
        MemberVotesTool(),
        GoogleCivicTool(),
        BraveSearchTool(),
        SummarizeBillTool()
    ]
    
    # Define the prompt locally to avoid dependency on LangSmith Hub
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Contextual Hint: {context}\n\n"
                   f"Today's Date: {current_date}\n\n"
                   "You are a helpful assistant specialized in US Congress and civic information. "
                   "Use the provided tools to search for and retrieve representative details. "
                   "- Use 'get_representatives_by_address' when a user provides an address or asks who represents them locally. "
                   "- Use 'search_congress_members_by_state' when asked about members from a specific state or region. "
                   "- Use 'search_congress_member_by_name' when you have a specific person's name. "
                   "- Use 'get_congress_member_details' to get full info once you have a Bioguide ID. "
                   "- Use 'get_member_recent_votes' to see how a House representative voted on recent bills. "
                   "- Use 'summarize_congressional_bill' if a user asks for a summary or explanation of a specific bill (HR 1, etc.). "
                   "- Use 'web_search' ONLY as a fallback if official Congress or Civic data is unavailable, or to look up very recent news/scandals/biographical details not in official records. "
                   "If you cannot find a member, explain why or suggest alternative names. "
                   "\n\nFormatting Guidelines:\n"
                   "- Always provide clickable links using Markdown [Link Text](URL).\n"
                   "- For more information about a specific Congress member, use this exact phrasing: 'For more information, you can [visit his/her official profile](https://www.congress.gov/member/BIOGUIDE_ID) or create a new COSINT page.' (Replace BIOGUIDE_ID with their actual ID).\n"
                   "- Do NOT append extra links like 'Member Name's Profile' at the end of your response.\n"
                   "- ACTION TRIGGER: If you have identified a specific representative the user is asking about, append this tag at the very end of your response: [CREATE_PAGE_ACTION: Member Name | BIOGUIDE_ID]\n"
                   "- Ensure links are descriptive (e.g., [S.Res.101](URL) instead of just [Link](URL)).\n"
                   "- If possible, prefer links to the official Congress.gov website for specific bills."
                   "\n- BILL TRACKING: If a user asks to 'track', 'follow', or 'save' a bill, identify the Congress, Bill Type, Bill Number, and Title. "
                   "  At the end of your response, output a TRACK_BILL tag.\n"
                   "  Format: [TRACK_BILL: Congress | Type | Number | Title]"),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])
    
    agent = create_openai_tools_agent(llm, tools, prompt)
    agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=False)
    
    return agent_executor

class IntelPacket(BaseModel):
    title: str = Field(description="Short category title (e.g., 'Legal Record', 'Senate Term')")
    content: str = Field(description="Extremely concise summarized fact or key-value pair. No full sentences.")
    is_useful: bool = Field(description="Whether this information is significant enough to be pinned")

def get_intel_extraction_agent():
    """
    A specialized agent responsible for analyzing chat messages and extracting
    modular information for the Research Notebook with extreme conciseness.
    """
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    structured_llm = llm.with_structured_output(IntelPacket)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an OSINT Intelligence Analyst. Your job is to extract specific facts from the AI response about a Congressional representative or legislative activity. "
                   "If the response contains a significant, new fact (district details, committee roles, career milestones, specific votes, or important links), set is_useful to true. "
                   "CRITICAL: Do NOT capture meta-information like the current date, time, user greetings, or off-topic conversational content. "
                   "CRITICAL: The 'content' must be EXTREMELY CONCISE. Use a 'Label: Value' format. "
                   "If the response contains a relevant link (e.g., to a speech, a video, or an official document), ALWAYS include it in the content using Markdown format: [Source Name](URL). "
                   "Example: 'Senate Term: Jan 2025 - Jan 2031' or 'Inauguration Speech: [Read here](URL)'. "
                   "If the response is vague, lacks a specific new fact about the member, or is just conversational, set is_useful to false."),
        ("human", "Extract the key fact from this response: {response}")
    ])
    
    return prompt | structured_llm
